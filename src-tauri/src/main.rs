#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod platform;
mod shortcut;
mod storage;
#[cfg(windows)]
mod window_regression;
mod window_shape;
use platform::Action;
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Sender},
        Mutex,
    },
};
use storage::Snippet;
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize, Default)]
struct Picker {
    items: Vec<Snippet>,
    selected: usize,
    target: usize,
    active: bool,
}
#[derive(Debug, PartialEq)]
enum Selection {
    Paste(usize, String),
    Add,
}
impl Picker {
    fn begin(&mut self, items: Vec<Snippet>, target: usize) {
        *self = Self {
            items,
            selected: 0,
            target,
            active: true,
        };
    }
    fn step(&mut self, delta: i32) {
        if self.active {
            self.selected =
                (self.selected as i32 + delta).rem_euclid(self.items.len() as i32 + 1) as usize;
        }
    }
    fn finish(&mut self, paste: bool) -> Option<Selection> {
        if !self.active {
            return None;
        }
        self.active = false;
        if paste && self.selected == self.items.len() {
            Some(Selection::Add)
        } else if paste {
            self.items
                .get(self.selected)
                .map(|s| Selection::Paste(self.target, s.text.clone()))
        } else {
            None
        }
    }
}
struct State {
    items: Mutex<Vec<Snippet>>,
    picker: Mutex<Picker>,
    status: Mutex<String>,
    path: PathBuf,
    tx: Sender<Action>,
    pending_new: AtomicBool,
    shortcut: Mutex<shortcut::Shortcut>,
    shortcut_path: PathBuf,
    preview: bool,
}
struct UiMenu {
    manage: tauri::menu::MenuItem<tauri::Wry>,
    quit: tauri::menu::MenuItem<tauri::Wry>,
}
#[tauri::command]
fn set_ui_language(app: tauri::AppHandle, language: String) -> Result<(), String> {
    let (manage_text, quit_text, title) = match language.as_str() {
        "zh-TW" => ("管理短句", "結束 before-you-do", "before-you-do · 常用短句"),
        "zh-CN" => ("管理短句", "退出 before-you-do", "before-you-do · 常用短句"),
        "ja" => (
            "短文を管理",
            "before-you-do を終了",
            "before-you-do · 短文ライブラリ",
        ),
        _ => (
            "Manage snippets",
            "Quit before-you-do",
            "before-you-do · Snippets",
        ),
    };
    let menu = app.state::<UiMenu>();
    menu.manage
        .set_text(manage_text)
        .map_err(|e| e.to_string())?;
    menu.quit.set_text(quit_text).map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        window.set_title(title).map_err(|e| e.to_string())?;
    }
    Ok(())
}
// Exercises the real picker state and event delivery without registering a shortcut,
// focusing a window, injecting keys, or pasting into another application.
#[tauri::command]
fn preview_picker(
    app: tauri::AppHandle,
    action: String,
    delta: Option<i32>,
) -> Result<serde_json::Value, String> {
    if !std::env::args().any(|arg| arg == "--design-preview") {
        return Err("Preview mode required".into());
    }
    let state = app.state::<State>();
    let mut picker = state.picker.lock().unwrap();
    let mut result = serde_json::Value::Null;
    match action.as_str() {
        "begin" => picker.begin(state.items.lock().unwrap().clone(), 0),
        "move" => picker.step(delta.unwrap_or(1)),
        "commit" => {
            result = match picker.finish(true) {
                Some(Selection::Paste(_, text)) => serde_json::json!({"kind":"paste","text":text}),
                Some(Selection::Add) => serde_json::json!({"kind":"add"}),
                None => serde_json::Value::Null,
            }
        }
        "cancel" => {
            picker.finish(false);
        }
        _ => return Err("Unknown preview action".into()),
    }
    app.emit_to("picker", "picker-state", picker.clone())
        .map_err(|e| e.to_string())?;
    Ok(result)
}
#[tauri::command]
fn get_shortcut(state: tauri::State<State>) -> shortcut::Shortcut {
    state.shortcut.lock().unwrap().clone()
}
#[tauri::command]
fn save_shortcut(
    app: tauri::AppHandle,
    shortcut: shortcut::Shortcut,
) -> Result<shortcut::Shortcut, String> {
    shortcut.validate()?;
    let state = app.state::<State>();
    let mut current = state.shortcut.lock().unwrap();
    let previous = current.clone();
    if !state.preview {
        platform::start(state.tx.clone(), shortcut.clone())?;
    }
    if let Err(error) = shortcut::save(&state.shortcut_path, &shortcut) {
        if !state.preview {
            if let Err(rollback) = platform::configure(previous) {
                set_status(&app, rollback);
            }
        }
        return Err(error);
    }
    *current = shortcut.clone();
    drop(current);
    let _ = app.emit("shortcut-changed", shortcut.clone());
    if !state.preview {
        set_status(&app, "已啟用".into());
    }
    Ok(shortcut)
}
#[tauri::command]
fn get_snippets(state: tauri::State<State>) -> Vec<Snippet> {
    state.items.lock().unwrap().clone()
}
#[tauri::command]
fn save_snippets(items: Vec<Snippet>, state: tauri::State<State>) -> Result<(), String> {
    storage::save(&state.path, &items)?;
    *state.items.lock().unwrap() = items;
    Ok(())
}
#[tauri::command]
fn storage_info(state: tauri::State<State>) -> serde_json::Value {
    serde_json::json!({"path": state.path.to_string_lossy(), "backup": state.path.with_extension("json.bak").to_string_lossy(), "exists": state.path.exists()})
}
#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .map_err(|e| e.to_string())?
        .set_text(text)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn open_data_folder(state: tauri::State<State>) -> Result<(), String> {
    let folder = state.path.parent().ok_or("找不到資料夾")?;
    std::fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer.exe")
        .arg(folder)
        .spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(folder).spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(folder).spawn();
    result.map(|_| ()).map_err(|e| e.to_string())
}
#[tauri::command]
fn reload_snippets(state: tauri::State<State>) -> Result<Vec<Snippet>, String> {
    if !state.path.exists() {
        return Err("error.no_file".into());
    }
    let items = storage::load(&state.path, None)?;
    *state.items.lock().unwrap() = items.clone();
    Ok(items)
}
#[tauri::command]
fn picker_state(state: tauri::State<State>) -> Picker {
    state.picker.lock().unwrap().clone()
}
#[tauri::command]
fn consume_new_snippet(state: tauri::State<State>) -> bool {
    state.pending_new.swap(false, Ordering::SeqCst)
}
#[tauri::command]
fn native_status(state: tauri::State<State>) -> String {
    state.status.lock().unwrap().clone()
}
#[tauri::command]
fn restart_keyboard(app: tauri::AppHandle) {
    start_keyboard(&app);
}
#[tauri::command]
fn hide_manager(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}
#[tauri::command]
fn window_action(window: tauri::WebviewWindow, action: String) -> Result<(), String> {
    if window.label() != "main" {
        return Err("只允許操作管理視窗".into());
    }
    match action.as_str() {
        "drag" => window.start_dragging(),
        "minimize" => window.minimize(),
        "maximize" => {
            if window.is_maximized().map_err(|e| e.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        _ => return Err("未知的視窗操作".into()),
    }
    .map_err(|e| e.to_string())
}
#[tauri::command]
fn configure_glass(app: tauri::AppHandle, dark: bool, transparency: u8) -> Result<(), String> {
    for label in ["main", "picker"] {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_theme(Some(if dark {
                    tauri::Theme::Dark
                } else {
                    tauri::Theme::Light
                }))
                .map_err(|e| e.to_string())?;
            #[cfg(target_os = "windows")]
            {
                // Windows 10 Blur and DWM shadows can leave a rectangular
                // backing outside the client mask. Keep the native edge clear.
                let _ = transparency;
                window.set_effects(None).map_err(|e| e.to_string())?;
                window.set_shadow(false).map_err(|e| e.to_string())?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                use tauri::window::{Color, Effect, EffectState, EffectsBuilder};
                let alpha = (85.0 + (100 - transparency.clamp(15, 85)) as f64 * 1.2) as u8;
                let color = if dark {
                    Color(32, 32, 32, alpha)
                } else {
                    Color(245, 245, 245, alpha)
                };
                let effects = EffectsBuilder::new()
                    .color(color)
                    .radius(18.0)
                    .state(EffectState::Active);
                #[cfg(target_os = "macos")]
                let effects =
                    effects
                        .effect(Effect::LiquidGlassClear)
                        .effect(if label == "picker" {
                            Effect::Popover
                        } else {
                            Effect::UnderWindowBackground
                        });
                window
                    .set_effects(effects.build())
                    .map_err(|e| e.to_string())?;
            }
            let maximized = window_shape::apply(&window)?;
            let _ = window.emit("window-layout", maximized);
        }
    }
    Ok(())
}
fn set_status(app: &tauri::AppHandle, message: String) {
    *app.state::<State>().status.lock().unwrap() = message;
    let _ = app.emit_to("main", "native-status", ());
}
fn start_keyboard(app: &tauri::AppHandle) {
    let state = app.state::<State>();
    if state.preview {
        return;
    }
    let shortcut = state.shortcut.lock().unwrap().clone();
    let result = platform::start(state.tx.clone(), shortcut);
    set_status(
        app,
        result.map(|_| "已啟用".to_string()).unwrap_or_else(|e| e),
    );
}
fn manage(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}
fn handle_action(app: &tauri::AppHandle, action: Action) {
    diagnostic(&format!("action: {action:?}"));
    let state = app.state::<State>();
    match action {
        Action::Begin(target) => {
            let items = state.items.lock().unwrap().clone();
            {
                let mut picker = state.picker.lock().unwrap();
                picker.begin(items, target);
                let _ = app.emit_to("picker", "picker-state", picker.clone());
            }
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || {
                if let Some(w) = handle.get_webview_window("picker") {
                    let _ = w.center();
                    let _ = w.show();
                    #[cfg(windows)]
                    window_regression::record("alt-h-open", &w);
                }
            });
        }
        Action::Move(delta) => {
            let mut picker = state.picker.lock().unwrap();
            picker.step(delta);
            let _ = app.emit_to("picker", "picker-state", picker.clone());
        }
        Action::Commit | Action::Cancel => {
            let paste = matches!(action, Action::Commit);
            let chosen = state.picker.lock().unwrap().finish(paste);
            let handle = app.clone();
            let (tx, rx) = mpsc::channel();
            let _ = app.run_on_main_thread(move || {
                if let Some(w) = handle.get_webview_window("picker") {
                    let _ = w.hide();
                }
                let _ = tx.send(());
            });
            if let Some(Selection::Paste(target, text)) = chosen {
                if rx.recv_timeout(std::time::Duration::from_secs(2)).is_ok() {
                    if let Err(error) = platform::paste(target, &text) {
                        diagnostic(&format!("paste error: {error}"));
                        set_status(app, error);
                    } else {
                        diagnostic("paste input sent");
                    }
                }
            } else if chosen == Some(Selection::Add) {
                state.pending_new.store(true, Ordering::SeqCst);
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || {
                    manage(&handle);
                    let _ = handle.emit_to("main", "new-snippet", ());
                });
            }
        }
        Action::Error(error) => set_status(app, error),
    }
}
fn diagnostic(message: &str) {
    use std::io::Write;
    static ENABLED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    if *ENABLED.get_or_init(|| std::env::args().any(|arg| arg == "--integration-test")) {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(std::env::temp_dir().join("quicksay-integration.log"))
        {
            let _ = writeln!(file, "{message}");
        }
    }
}
fn main() {
    let preview = std::env::args().any(|arg| arg == "--design-preview");
    let builder = tauri::Builder::default();
    let builder = if preview {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, _, _| manage(app)))
    };
    builder
        .invoke_handler(tauri::generate_handler![
            get_snippets,
            get_shortcut,
            save_shortcut,
            save_snippets,
            storage_info,
            copy_text,
            open_data_folder,
            reload_snippets,
            set_ui_language,
            preview_picker,
            picker_state,
            native_status,
            restart_keyboard,
            hide_manager,
            window_action,
            configure_glass,
            consume_new_snippet
        ])
        .setup(move |app| {
            let integration = std::env::args().any(|arg| arg == "--integration-test");
            let source_path = app.path().app_config_dir()?.join("snippets.json");
            let path = if preview {
                std::env::temp_dir().join(format!(
                    "quicksay-design-preview-{}/snippets.json",
                    std::process::id()
                ))
            } else if integration {
                std::env::temp_dir().join("quicksay-integration/snippets.json")
            } else {
                app.path().app_config_dir()?.join("snippets.json")
            };
            let old =
                std::env::var_os("APPDATA").map(|p| PathBuf::from(p).join("QuickSay/settings.xml"));
            let items = if integration {
                storage::defaults().into_iter().take(2).collect()
            } else {
                storage::load(if preview { &source_path } else { &path }, old.as_deref())
                    .map_err(std::io::Error::other)?
            };
            let shortcut_path = path.with_file_name("shortcut.json");
            let loaded_shortcut = shortcut::load(&shortcut_path);
            let shortcut_error = loaded_shortcut.as_ref().err().cloned();
            let initial_shortcut = loaded_shortcut.unwrap_or_default();
            let (tx, rx) = mpsc::channel();
            app.manage(State {
                items: Mutex::new(items),
                shortcut: Mutex::new(initial_shortcut),
                shortcut_path,
                preview,
                picker: Mutex::new(Picker::default()),
                status: Mutex::new(String::new()),
                path,
                tx,
                pending_new: AtomicBool::new(std::env::args().any(|arg| arg == "--new-snippet")),
            });
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Ok(action) = rx.recv() {
                    handle_action(&handle, action);
                }
            });
            let manage_item = tauri::menu::MenuItem::with_id(
                app,
                "manage",
                "Manage snippets",
                true,
                None::<&str>,
            )?;
            let quit_item = tauri::menu::MenuItem::with_id(
                app,
                "quit",
                "Quit before-you-do",
                true,
                None::<&str>,
            )?;
            let menu = tauri::menu::Menu::with_items(app, &[&manage_item, &quit_item])?;
            app.manage(UiMenu {
                manage: manage_item,
                quit: quit_item,
            });
            let icon = tauri::image::Image::new_owned(
                include_bytes!("../icons/tray.rgba").to_vec(),
                32,
                32,
            );
            tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .tooltip("before-you-do")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "manage" => manage(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            let main = app.get_webview_window("main").unwrap();
            // Prefer a tall library/editor, but stay inside the monitor's usable
            // work area (taskbar excluded), including scaled laptop displays.
            if let Some(monitor) = main.current_monitor()? {
                let scale = monitor.scale_factor();
                let area = monitor.work_area();
                let width = 940.0_f64.min((area.size.width as f64 / scale - 32.0).max(1.0));
                let height = 820.0_f64.min((area.size.height as f64 / scale - 32.0).max(1.0));
                main.set_min_size(Some(tauri::LogicalSize::new(
                    780.0_f64.min(width),
                    680.0_f64.min(height),
                )))?;
                main.set_size(tauri::LogicalSize::new(width, height))?;
                main.set_position(tauri::PhysicalPosition::new(
                    area.position.x
                        + ((area.size.width as f64 - width * scale) / 2.0).round() as i32,
                    area.position.y
                        + ((area.size.height as f64 - height * scale) / 2.0).round() as i32,
                ))?;
            }
            let app_handle = app.handle().clone();
            main.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = app_handle.emit_to("main", "save-before-hide", ());
                }
            });
            if let Some(picker) = app.get_webview_window("picker") {
                picker.set_ignore_cursor_events(true)?;
            }
            for label in ["main", "picker"] {
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window_shape::apply(&window);
                    let handle = window.clone();
                    window.on_window_event(move |event| {
                        if matches!(
                            event,
                            tauri::WindowEvent::Resized(_)
                                | tauri::WindowEvent::ScaleFactorChanged { .. }
                        ) {
                            if let Ok(maximized) = window_shape::apply(&handle) {
                                let _ = handle.emit("window-layout", maximized);
                            }
                        }
                    });
                }
            }
            #[cfg(windows)]
            window_regression::start(app.handle());
            #[cfg(windows)]
            if std::env::args().any(|arg| arg == "--visual-audit") {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    let h = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        let results: Vec<_> = ["main", "picker"]
                            .iter()
                            .filter_map(|label| h.get_webview_window(label))
                            .map(|w| window_shape::inspect(&w))
                            .collect();
                        if let Ok(exe) = std::env::current_exe() {
                            let _ = std::fs::write(
                                exe.with_extension("shape-audit.json"),
                                serde_json::to_string_pretty(&results).unwrap(),
                            );
                        }
                    });
                });
            }
            if preview {
                set_status(
                    app.handle(),
                    "外觀預覽 · 快捷鍵由原視窗提供；此預覽只儲存暫存資料。".into(),
                );
            } else {
                start_keyboard(app.handle());
                if let Some(error) = shortcut_error {
                    set_status(app.handle(), error);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("無法啟動 before-you-do");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn selection_wraps_and_commits_once() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(1);
        assert_eq!(p.selected, 1);
        let expected = p.items[1].text.clone();
        assert_eq!(p.finish(true), Some(Selection::Paste(123, expected)));
        assert_eq!(p.finish(true), None);
    }
    #[test]
    fn cancel_never_pastes() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(1);
        assert_eq!(p.finish(false), None);
        assert_eq!(p.finish(true), None);
    }
    #[test]
    fn selection_snapshot_survives_edits() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 5);
        let mut changed = storage::defaults();
        changed.clear();
        assert_eq!(p.items.len(), storage::defaults().len());
        assert!(p.finish(true).is_some());
    }
    #[test]
    fn last_row_opens_add_without_pasting() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(-1);
        assert_eq!(p.selected, p.items.len());
        assert_eq!(p.finish(true), Some(Selection::Add));
        assert_eq!(p.finish(true), None);
    }
    #[test]
    fn add_row_wraps_and_can_be_cancelled() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(p.items.len() as i32);
        assert_eq!(p.selected, p.items.len());
        p.step(1);
        assert_eq!(p.selected, 0);
        p.step(-1);
        assert_eq!(p.finish(false), None);
    }
}
