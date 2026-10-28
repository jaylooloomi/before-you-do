use std::sync::mpsc::Sender;
#[derive(Debug)]
pub enum Action {
    Begin(usize),
    Dismiss,
    Move(i32),
    Role(i32),
    Commit,
    Cancel,
    Error(String),
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
