use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex};
use tauri::{Emitter, Manager};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Config {
    pub region: String,
    pub fullscreen: String,
    pub window: String,
    pub video: String,
    pub gif: String,
    #[serde(default="default_text")]
    pub text: String,
    #[serde(default="default_file")]
    pub file: String,
}
fn default_text()->String{"Ctrl+Shift+F11".into()}
fn default_file()->String{"Ctrl+Shift+F12".into()}
impl Default for Config {
    fn default() -> Self {
        Self {
            region: "Shift+PrintScreen".into(),
            fullscreen: "PrintScreen".into(),
            window: "Alt+PrintScreen".into(),
            video: "Ctrl+Shift+PrintScreen".into(),
            gif: "Ctrl+Alt+Shift+PrintScreen".into(),
            text:default_text(),file:default_file(),
        }
    }
}
impl Config {
    pub fn entries(&self) -> [(&str, &str); 7] {
        [
            (&self.region, "region"),
            (&self.fullscreen, "fullscreen"),
            (&self.window, "window"),
            (&self.video, "record-video"),
            (&self.gif, "record-gif"),
            (&self.text,"add-text"),(&self.file,"add-file"),
        ]
    }
    pub fn validate(&self) -> Result<(), String> {
        let mut seen = std::collections::HashSet::new();
        for (value, _) in self.entries() {
            if let Some(key) = parse(value)? {
                if !seen.insert(key) {
                    return Err("Capture shortcuts must be different".into());
                }
            }
        }
        Ok(())
    }
}
pub fn parse(value: &str) -> Result<Option<(u32, u32)>, String> {
    if value.trim().is_empty() {
        return Ok(None);
    }
    let mut modifiers = 0;
    let mut key = None;
    for part in value.split('+') {
        let part = part.trim().to_ascii_lowercase();
        let mask = match part.as_str() {
            "ctrl" | "control" => 2,
            "alt" => 1,
            "shift" => 4,
            _ => 0,
        };
        if mask != 0 {
            if modifiers & mask != 0 {
                return Err("Duplicate modifier".into());
            }
            modifiers |= mask;
            continue;
        }
        if key.is_some() {
            return Err("Use one PrintScreen or F6–F12 key".into());
        }
        key = Some(match part.as_str() {
            "printscreen" | "prtsc" | "prtscr" => 0x2c,
            "f6" => 0x75,
            "f7" => 0x76,
            "f8" => 0x77,
            "f9" => 0x78,
            "f10" => 0x79,
            "f11" => 0x7a,
            "f12" => 0x7b,
            _ => {
                return Err(
                    "Use Ctrl/Alt/Shift with PrintScreen or F6–F12; leave blank to disable".into(),
                )
            }
        });
    }
    Ok(Some((modifiers, key.ok_or("Missing shortcut key")?)))
}
#[derive(Clone, Serialize)]
pub struct View {
    pub supported: bool,
    pub config: Config,
    pub registered: bool,
    pub error: Option<String>,
}
pub struct Hotkeys {
    path: PathBuf,
    view: Mutex<View>,
    #[cfg(windows)]
    thread: std::sync::atomic::AtomicU32,
    #[cfg(windows)]
    pending: Mutex<Option<(Config, std::sync::mpsc::SyncSender<Result<(), String>>)>>,
    change: Mutex<()>,
}
impl Hotkeys {
    pub fn new(path: PathBuf) -> Self {
        let loaded = if path.exists() {
            std::fs::read(&path)
                .map_err(|e| e.to_string())
                .and_then(|b| serde_json::from_slice::<Config>(&b).map_err(|e| e.to_string()))
                .and_then(|c| {
                    c.validate()?;
                    Ok(c)
                })
        } else {
            Ok(Config::default())
        };
        let error = loaded.as_ref().err().cloned();
        Self {
            path,
            view: Mutex::new(View {
                supported: cfg!(windows),
                config: loaded.unwrap_or_default(),
                registered: false,
                error,
            }),
            #[cfg(windows)]
            thread: std::sync::atomic::AtomicU32::new(0),
            #[cfg(windows)]
            pending: Mutex::new(None),
            change: Mutex::new(()),
        }
    }
}
#[tauri::command]
pub fn capture_hotkeys_get(
    w: tauri::WebviewWindow,
    state: tauri::State<Hotkeys>,
) -> Result<View, String> {
    if w.label() != "main" {
        return Err("Manager only".into());
    }
    Ok(state.view.lock().unwrap().clone())
}
#[tauri::command]
pub async fn capture_hotkeys_save(
    w: tauri::WebviewWindow,
    app: tauri::AppHandle,
    config: Config,
) -> Result<View, String> {
    if w.label() != "main" {
        return Err("Manager only".into());
    }
    config.validate()?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Hotkeys>();
        let _change = state.change.lock().unwrap();
        let previous = state.view.lock().unwrap().config.clone();
        configure(&app, config.clone())?;
        let result = (|| {
            if let Some(parent) = state.path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let temp = state.path.with_extension("json.tmp");
            std::fs::write(
                &temp,
                serde_json::to_vec_pretty(&config).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            std::fs::rename(temp, &state.path).map_err(|e| e.to_string())
        })();
        if let Err(error) = result {
            let _ = configure(&app, previous);
            return Err(error);
        }
        let view = state.view.lock().unwrap().clone();
        let _ = app.emit_to("main", "capture-hotkeys-changed", view.clone());
        Ok(view)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(not(windows))]
fn configure(_: &tauri::AppHandle, _: Config) -> Result<(), String> {
    Err("Capture shortcuts currently support Windows only".into())
}
#[cfg(not(windows))]
pub fn start(_: tauri::AppHandle) {}
#[cfg(windows)]
fn configure(app: &tauri::AppHandle, config: Config) -> Result<(), String> {
    use std::sync::atomic::Ordering;
    let state = app.state::<Hotkeys>();
    let thread = state.thread.load(Ordering::SeqCst);
    if thread == 0 {
        return Err("Capture shortcut service unavailable".into());
    }
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    *state.pending.lock().unwrap() = Some((config, tx));
    if unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::PostThreadMessageW(thread, 0x8000 + 120, 0, 0)
    } == 0
    {
        return Err("Capture shortcut service unavailable".into());
    }
    rx.recv_timeout(std::time::Duration::from_secs(5))
        .map_err(|_| "Capture shortcut update timed out".to_string())?
}
#[cfg(windows)]
pub fn start(app: tauri::AppHandle) {
    std::thread::spawn(move || unsafe {
        use std::sync::atomic::Ordering;
        use windows_sys::Win32::UI::{Input::KeyboardAndMouse::*, WindowsAndMessaging::*};
        let state = app.state::<Hotkeys>();
        let mut config = state.view.lock().unwrap().config.clone();
        let register = |config: &Config| -> Result<(), String> {
            let mut registered = Vec::new();
            for (i, (value, _)) in config.entries().iter().enumerate() {
                if let Some((mods, key)) = parse(value)? {
                    if RegisterHotKey(
                        std::ptr::null_mut(),
                        100 + i as i32,
                        mods | MOD_NOREPEAT,
                        key,
                    ) == 0
                    {
                        for id in registered {
                            UnregisterHotKey(std::ptr::null_mut(), id);
                        }
                        return Err(format!("Shortcut conflict: {value}. Change the binding or close the other screenshot app."));
                    }
                    registered.push(100 + i as i32);
                }
            }
            Ok(())
        };
        let unregister = || {
            for id in 100..107 {
                UnregisterHotKey(std::ptr::null_mut(), id);
            }
        };
        let result = register(&config);
        {
            let mut view = state.view.lock().unwrap();
            view.registered = result.is_ok();
            if let Err(e) = result {
                view.error = Some(e);
            }
        }
        let mut msg: MSG = std::mem::zeroed();
        PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
        state.thread.store(
            windows_sys::Win32::System::Threading::GetCurrentThreadId(),
            Ordering::SeqCst,
        );
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            if msg.message == 0x8000 + 120 {
                if let Some((next, reply)) = state.pending.lock().unwrap().take() {
                    unregister();
                    let result = register(&next);
                    let rollback = if result.is_err() {
                        register(&config)
                    } else {
                        Ok(())
                    };
                    let mut view = state.view.lock().unwrap();
                    if result.is_ok() {
                        config = next.clone();
                        view.config = next;
                        view.registered = true;
                        view.error = None;
                    } else {
                        view.registered = rollback.is_ok();
                        view.error = result.as_ref().err().cloned();
                    }
                    let _ = reply.send(result);
                }
                continue;
            }
            if msg.message == WM_HOTKEY && (100..107).contains(&(msg.wParam as i32)) {
                let index = msg.wParam as usize - 100;
                let _ = app
                    .state::<crate::State>()
                    .tx
                    .send(crate::platform::Action::Capture(
                        config.entries()[index].1.into(),
                    ));
            }
        }
        unregister();
        state.thread.store(0, Ordering::SeqCst);
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_and_validation() {
        let c = Config::default();
        c.validate().unwrap();
        assert_eq!(parse(&c.region).unwrap(), Some((4, 0x2c)));
        assert_eq!(parse("Ctrl+Alt+F8").unwrap(), Some((3, 0x77)));
        assert_eq!(parse("").unwrap(), None);
        for s in [
            "Alt+H",
            "Ctrl+Ctrl+F8",
            "F6+F7",
            "Ctrl",
            "PrintScreen+garbage",
        ] {
            assert!(parse(s).is_err());
        }
        let legacy:Config=serde_json::from_str(r#"{"region":"","fullscreen":"","window":"","video":"","gif":""}"#).unwrap();
        assert_eq!(legacy.text,"Ctrl+Shift+F11");assert_eq!(legacy.file,"Ctrl+Shift+F12");
        let mut clash=c.clone();clash.file=clash.text.clone();assert!(clash.validate().is_err());
        let mut duplicate = c.clone();
        duplicate.gif = duplicate.video.clone();
        assert!(duplicate.validate().is_err());
    }
}
