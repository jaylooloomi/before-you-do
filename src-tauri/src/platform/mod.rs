use std::sync::mpsc::Sender;
#[derive(Debug)]
pub enum Action {
    Begin(usize),
    Capture(String),
    RecordShortcut(String),
    QuickRelease(u64),
    QuickKey(u32),
    Dismiss,
    Move(i32),
    Role(i32),
    Commit,
    Cancel,
    Error(String),
}
pub fn copy_files(files:&[std::path::PathBuf])->Result<(),String>{
    if files.is_empty()||files.iter().any(|file|!file.is_file()){return Err("Material attachment missing".into());}
    let mut clipboard=arboard::Clipboard::new().map_err(|e|e.to_string())?;
    // arboard's file_list adds CF_HDROP without removing earlier formats.
    // Otherwise receivers may prefer stale text/PNG over the requested files.
    clipboard.clear().map_err(|e|e.to_string())?;
    clipboard.set().file_list(files).map_err(|e|e.to_string())
}
// macOS targets are process IDs, not window handles. Prefer the cursor monitor there.
#[cfg(not(windows))]
pub fn target_monitor_point(_: usize) -> Option<(i32,i32)> { None }
#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn start(_: Sender<Action>, _: crate::shortcut::Shortcut) -> Result<(), String> {
    Err("此版本的原生快捷鍵支援 Windows 與 macOS。".into())
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn paste(_: usize, _: &str) -> Result<(), String> {
    Err("不支援此平台".into())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn configure(_: crate::shortcut::Shortcut) -> Result<(), String> {
    Err("不支援此平台".into())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn is_app_target(_: usize) -> bool {
    false
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn foreground_target() -> Option<usize> {
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn cancel_selection() {}

#[cfg(not(windows))]
pub fn paste_files(_: usize, _: &[std::path::PathBuf])->Result<(),String>{Err("Batch attachment paste currently supports Windows only".into())}
#[cfg(not(windows))]
pub fn focus_target(_:usize)->Result<(),String>{Err("Returning to the original window currently supports Windows only".into())}
