use std::sync::mpsc::Sender;
#[derive(Debug)]
pub enum Action {
    Begin(usize),
    Move(i32),
    Commit,
    Cancel,
    Error(String),
}
#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn start(_: Sender<Action>) -> Result<(), String> {
    Err("此版本的原生快捷鍵支援 Windows 與 macOS。".into())
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn paste(_: usize, _: &str) -> Result<(), String> {
    Err("不支援此平台".into())
}
