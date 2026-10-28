use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct Status {
    pub supported: bool,
    pub enabled: bool,
}

pub fn is_background(args: impl IntoIterator<Item = String>) -> bool {
    args.into_iter().any(|arg| arg == "--autostart")
}

pub fn status() -> Result<Status, String> {
    Ok(Status {
        supported: cfg!(any(windows, target_os = "macos")),
        enabled: platform::enabled(&std::env::current_exe().map_err(|e| e.to_string())?)?,
    })
}

pub fn set(enabled: bool) -> Result<Status, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    platform::set(&exe, enabled)?;
    let actual = status()?;
    if actual.enabled != enabled {
        return Err("error.autostart_verify".into());
    }
    Ok(actual)
}

fn needs_default(preference: &Path) -> Result<bool, String> {
    match std::fs::read(preference) {
        Ok(bytes) => {
            #[derive(serde::Deserialize)]
            struct Preference {
                initialized: bool,
            }
            let value: Preference = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
            if !value.initialized {
                return Err("Invalid startup preference".into());
            }
            Ok(false)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}
fn remember(preference: &Path) -> Result<(), String> {
    std::fs::create_dir_all(preference.parent().ok_or("Missing preference folder")?)
        .map_err(|e| e.to_string())?;
    let temp = preference.with_extension("json.tmp");
    std::fs::write(&temp, b"{\"initialized\":true}\n").map_err(|e| e.to_string())?;
    std::fs::rename(temp, preference).map_err(|e| e.to_string())
}
pub fn set_and_remember(enabled: bool, preference: &Path) -> Result<Status, String> {
    let before = status()?;
    let actual = set(enabled)?;
    if let Err(error) = remember(preference) {
        set(before.enabled)
            .map_err(|rollback| format!("{error}; startup rollback failed: {rollback}"))?;
        return Err(error);
    }
    Ok(actual)
}
fn initialize_with(
    preference: &Path,
    enable: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    if needs_default(preference)? {
        enable()?;
    }
    Ok(())
}
pub fn initialize(preference: &Path) -> Result<(), String> {
    if !cfg!(any(windows, target_os = "macos")) {
        return Ok(());
    }
    initialize_with(preference, || {
        set_and_remember(true, preference).map(|_| ())
    })
}

#[cfg(windows)]
mod platform {
    use super::*;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::{
        Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS},
        System::Registry::*,
    };
    const KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const NAME: &str = "before-you-do";
    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(Some(0)).collect()
    }
    struct Key(HKEY);
    impl Drop for Key {
        fn drop(&mut self) {
            unsafe {
                RegCloseKey(self.0);
            }
        }
    }
    fn open(key: &str, create: bool) -> Result<Option<Key>, String> {
        let mut handle = std::ptr::null_mut();
        let key = wide(key);
        let code = unsafe {
            if create {
                RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    key.as_ptr(),
                    0,
                    std::ptr::null(),
                    0,
                    KEY_QUERY_VALUE | KEY_SET_VALUE,
                    std::ptr::null(),
                    &mut handle,
                    std::ptr::null_mut(),
                )
            } else {
                RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    key.as_ptr(),
                    0,
                    KEY_QUERY_VALUE,
                    &mut handle,
                )
            }
        };
        if code == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if code != ERROR_SUCCESS {
            return Err(format!("Windows registry error {code}"));
        }
        Ok(Some(Key(handle)))
    }
    pub(super) fn command(exe: &Path) -> Vec<u16> {
        let mut result = vec![b'"' as u16];
        result.extend(exe.as_os_str().encode_wide());
        result.extend("\" --autostart".encode_utf16());
        result.push(0);
        result
    }
    pub(super) fn read_at(key: &str) -> Result<Option<Vec<u16>>, String> {
        let Some(key) = open(key, false)? else {
            return Ok(None);
        };
        let name = wide(NAME);
        let mut kind = 0;
        let mut data = vec![0u16; 32768];
        let mut bytes = (data.len() * 2) as u32;
        let code = unsafe {
            RegQueryValueExW(
                key.0,
                name.as_ptr(),
                std::ptr::null(),
                &mut kind,
                data.as_mut_ptr().cast(),
                &mut bytes,
            )
        };
        if code == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if code != ERROR_SUCCESS {
            return Err(format!("Windows registry error {code}"));
        }
        if kind != REG_SZ || bytes % 2 != 0 {
            return Ok(None);
        }
        data.truncate(bytes as usize / 2);
        Ok(Some(data))
    }
    pub(super) fn set_at(key: &str, exe: &Path, enabled: bool) -> Result<(), String> {
        // A missing Run key needs no creation when disabling.
        if !enabled && read_at(key)?.is_none() {
            return Ok(());
        }
        let key = open(key, true)?.ok_or("Cannot open startup registry key")?;
        let name = wide(NAME);
        let code = unsafe {
            if enabled {
                let value = command(exe);
                RegSetValueExW(
                    key.0,
                    name.as_ptr(),
                    0,
                    REG_SZ,
                    value.as_ptr().cast(),
                    (value.len() * 2) as u32,
                )
            } else {
                RegDeleteValueW(key.0, name.as_ptr())
            }
        };
        if code != ERROR_SUCCESS && !(code == ERROR_FILE_NOT_FOUND && !enabled) {
            return Err(format!("Windows registry error {code}"));
        }
        Ok(())
    }
    pub fn enabled(exe: &Path) -> Result<bool, String> {
        Ok(read_at(KEY)?.as_ref() == Some(&command(exe)))
    }
    pub fn set(exe: &Path, enabled: bool) -> Result<(), String> {
        set_at(KEY, exe, enabled)
    }
}

// Pure plist construction is also tested on Windows; never invoke a shell with the path.
#[cfg(any(target_os = "macos", test))]
fn plist(exe: &Path) -> String {
    let path = exe
        .to_string_lossy()
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;");
    format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\"><plist version=\"1.0\"><dict><key>Label</key><string>dev.quicksay.desktop.autostart</string><key>ProgramArguments</key><array><string>{path}</string><string>--autostart</string></array><key>RunAtLoad</key><true/></dict></plist>\n")
}
#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use std::{fs, path::PathBuf};
    fn file() -> Result<PathBuf, String> {
        Ok(
            PathBuf::from(std::env::var_os("HOME").ok_or("HOME missing")?)
                .join("Library/LaunchAgents/dev.quicksay.desktop.autostart.plist"),
        )
    }
    pub fn enabled(exe: &Path) -> Result<bool, String> {
        match fs::read_to_string(file()?) {
            Ok(value) => Ok(value == plist(exe)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e.to_string()),
        }
    }
    pub fn set(exe: &Path, enabled: bool) -> Result<(), String> {
        let file = file()?;
        if enabled {
            fs::create_dir_all(file.parent().unwrap()).map_err(|e| e.to_string())?;
            let temp = file.with_extension("plist.tmp");
            fs::write(&temp, plist(exe)).map_err(|e| e.to_string())?;
            fs::rename(temp, file).map_err(|e| e.to_string())?;
        } else if let Err(e) = fs::remove_file(file) {
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(e.to_string());
            }
        }
        Ok(())
    }
}
#[cfg(not(any(windows, target_os = "macos")))]
mod platform {
    use super::*;
    pub fn enabled(_: &Path) -> Result<bool, String> {
        Ok(false)
    }
    pub fn set(_: &Path, _: bool) -> Result<(), String> {
        Err("error.autostart_unsupported".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_enable_once_and_do_not_override_a_recorded_choice() {
        let dir = std::env::temp_dir().join(format!(
            "startup-default-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&dir).unwrap();
        let file = dir.join("autostart.json");
        let mut calls = 0;
        initialize_with(&file, || {
            calls += 1;
            remember(&file)
        })
        .unwrap();
        initialize_with(&file, || {
            calls += 1;
            Ok(())
        })
        .unwrap();
        assert_eq!(calls, 1);
        std::fs::write(&file, b"broken").unwrap();
        assert!(initialize_with(&file, || {
            calls += 1;
            Ok(())
        })
        .is_err());
        assert_eq!(calls, 1);
        std::fs::remove_file(&file).unwrap();
        assert!(initialize_with(&file, || Err("OS denied".into())).is_err());
        assert!(!file.exists());
        std::fs::remove_dir(dir).unwrap();
    }
    #[test]
    fn background_argument_is_exact() {
        assert!(is_background(vec!["app".into(), "--autostart".into()]));
        assert!(!is_background(vec![
            "app".into(),
            "--autostart=false".into()
        ]));
    }
    #[test]
    fn launch_agent_escapes_paths_and_runs_only_at_login() {
        let value = plist(Path::new(
            "/Applications/A & <B> '日本語'.app/Contents/MacOS/app",
        ));
        assert!(value.contains("A &amp; &lt;B&gt; &apos;日本語&apos;"));
        assert!(value.contains("<string>--autostart</string>"));
        assert!(value.contains("<key>RunAtLoad</key><true/>"));
        assert!(!value.contains("KeepAlive"));
    }
    #[cfg(windows)]
    #[test]
    fn registry_roundtrip_uses_isolated_key_and_preserves_unicode_path() {
        use windows_sys::Win32::System::Registry::*;
        let key = format!(
            "Software\\before-you-do-tests\\autostart-{}",
            std::process::id()
        );
        let exe = Path::new("C:\\Users\\測試 User\\before-you-do.exe");
        assert!(platform::read_at(&key).unwrap().is_none());
        platform::set_at(&key, exe, true).unwrap();
        assert_eq!(
            platform::read_at(&key).unwrap(),
            Some(platform::command(exe))
        );
        assert_eq!(
            String::from_utf16_lossy(&platform::command(exe)),
            "\"C:\\Users\\測試 User\\before-you-do.exe\" --autostart\0"
        );
        platform::set_at(&key, exe, false).unwrap();
        platform::set_at(&key, exe, false).unwrap();
        assert!(platform::read_at(&key).unwrap().is_none());
        let key: Vec<u16> = key.encode_utf16().chain(Some(0)).collect();
        unsafe {
            RegDeleteKeyW(HKEY_CURRENT_USER, key.as_ptr());
        }
    }
}
