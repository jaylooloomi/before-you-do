use super::{Action, Sender};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
    time::Duration,
};
use windows_sys::Win32::{
    Foundation::*,
    System::LibraryLoader::GetModuleHandleW,
    UI::{Input::KeyboardAndMouse::*, WindowsAndMessaging::*},
};

static TX: OnceLock<Sender<Action>> = OnceLock::new();
static ACTIVE: AtomicBool = AtomicBool::new(false);
static STARTED: AtomicBool = AtomicBool::new(false);
static H_DOWN: AtomicBool = AtomicBool::new(false);
fn send(action: Action) {
    if let Some(tx) = TX.get() {
        let _ = tx.send(action);
    }
}
unsafe extern "system" fn keyboard(code: i32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    // Track physical presses even before WM_HOTKEY opens the picker. Holding H
    // generates repeated key-downs; only a release followed by another press
    // should toggle the picker closed.
    let mut repeated_h = false;
    if code >= 0 {
        let event = &*(lp as *const KBDLLHOOKSTRUCT);
        if event.vkCode == 0x48 {
            let up = wp as u32 == WM_KEYUP || wp as u32 == WM_SYSKEYUP;
            repeated_h = H_DOWN.swap(!up, Ordering::SeqCst) && !up;
        }
    }
    if code >= 0 && ACTIVE.load(Ordering::Relaxed) {
        let key = (*(lp as *const KBDLLHOOKSTRUCT)).vkCode;
        let up = wp as u32 == WM_KEYUP || wp as u32 == WM_SYSKEYUP;
        match key {
            0x12 | 0xA4 | 0xA5 => {
                if up && ACTIVE.swap(false, Ordering::SeqCst) {
                    send(Action::Commit);
                }
            }
            0x26 | 0x28 => {
                if !up {
                    send(Action::Move(if key == 0x26 { -1 } else { 1 }));
                    return 1;
                }
            }
            0x1B => {
                if !up {
                    ACTIVE.store(false, Ordering::SeqCst);
                    send(Action::Cancel);
                }
                return 1;
            }
            0x48 if !up => {
                if !repeated_h {
                    ACTIVE.store(false, Ordering::SeqCst);
                    send(Action::Cancel);
                }
                return 1;
            }
            _ => {}
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wp, lp)
}
pub fn start(tx: Sender<Action>) -> Result<(), String> {
    if STARTED.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let _ = TX.set(tx);
    let (ready_rx_tx, ready_rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || unsafe {
        if RegisterHotKey(std::ptr::null_mut(), 1, MOD_ALT | MOD_NOREPEAT, 0x48) == 0 {
            STARTED.store(false, Ordering::SeqCst);
            let _ = ready_rx_tx.send(Err(
                "Alt+H 已被占用。請結束舊版 Before You Do 或 QuickAsk.ahk，再按重新啟用。".into(),
            ));
            return;
        }
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard),
            GetModuleHandleW(std::ptr::null()),
            0,
        );
        if hook.is_null() {
            UnregisterHotKey(std::ptr::null_mut(), 1);
            STARTED.store(false, Ordering::SeqCst);
            let _ = ready_rx_tx.send(Err("無法啟用鍵盤事件監聽。".into()));
            return;
        }
        let _ = ready_rx_tx.send(Ok(()));
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            if msg.message == WM_HOTKEY && !ACTIVE.swap(true, Ordering::SeqCst) {
                send(Action::Begin(GetForegroundWindow() as usize));
                if GetAsyncKeyState(VK_MENU as i32) >= 0 {
                    ACTIVE.store(false, Ordering::SeqCst);
                    send(Action::Commit);
                }
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnhookWindowsHookEx(hook);
        UnregisterHotKey(std::ptr::null_mut(), 1);
        STARTED.store(false, Ordering::SeqCst);
        send(Action::Error("鍵盤事件監聽已停止，請重新啟用。".into()));
    });
    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?
}
pub fn paste(target: usize, text: &str) -> Result<(), String> {
    unsafe {
        crate::diagnostic(&format!(
            "paste target={target} foreground={} Alt={} H={} Ctrl={} Shift={}",
            GetForegroundWindow() as usize,
            GetAsyncKeyState(VK_MENU as i32) < 0,
            GetAsyncKeyState(0x48) < 0,
            GetAsyncKeyState(VK_CONTROL as i32) < 0,
            GetAsyncKeyState(VK_SHIFT as i32) < 0
        ));
        for _ in 0..60 {
            if GetForegroundWindow() as usize != target {
                return Err("已切換視窗，這次貼入已取消。".into());
            }
            if [VK_MENU, VK_CONTROL, VK_SHIFT, 0x48]
                .iter()
                .all(|k| GetAsyncKeyState(*k as i32) >= 0)
            {
                let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
                clipboard.set_text(text).map_err(|e| e.to_string())?;
                if GetForegroundWindow() as usize != target {
                    return Err("已切換視窗，這次貼入已取消。".into());
                }
                let key = |vk, flags| INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: vk,
                            wScan: 0,
                            dwFlags: flags,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };
                let events = [
                    key(VK_CONTROL, 0),
                    key(0x56, 0),
                    key(0x56, KEYEVENTF_KEYUP),
                    key(VK_CONTROL, KEYEVENTF_KEYUP),
                ];
                if SendInput(
                    events.len() as u32,
                    events.as_ptr(),
                    std::mem::size_of::<INPUT>() as i32,
                ) != events.len() as u32
                {
                    return Err("系統拒絕貼上輸入，請確認目標程式的權限。".into());
                }
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        Err("按鍵仍被按住，這次貼入已取消。".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // Call the production hook with in-memory records only. No SendInput, window
    // activation or system shortcut registration occurs during this test.
    #[test]
    fn hook_repeat_toggle_navigation_and_release_without_system_input() {
        let (tx, rx) = std::sync::mpsc::channel();
        TX.set(tx).unwrap();
        let key = |vk: u32, message: u32| unsafe {
            let event = KBDLLHOOKSTRUCT {
                vkCode: vk,
                ..std::mem::zeroed()
            };
            keyboard(0, message as WPARAM, &event as *const _ as LPARAM)
        };
        ACTIVE.store(false, Ordering::SeqCst);
        H_DOWN.store(false, Ordering::SeqCst);
        key(0x48, WM_SYSKEYDOWN);
        ACTIVE.store(true, Ordering::SeqCst); // WM_HOTKEY opened the picker.
        key(0x48, WM_SYSKEYDOWN); // auto-repeat must not close it
        assert!(ACTIVE.load(Ordering::SeqCst));
        assert!(rx.try_recv().is_err());
        key(0x48, WM_SYSKEYUP);
        key(0x48, WM_SYSKEYDOWN); // fresh second H cancels
        assert!(matches!(rx.recv().unwrap(), Action::Cancel));
        key(0x12, WM_SYSKEYUP);
        assert!(rx.try_recv().is_err()); // releasing Alt after cancel cannot paste
        key(0x48, WM_SYSKEYUP);
        ACTIVE.store(true, Ordering::SeqCst);
        key(0x28, WM_KEYDOWN);
        assert!(matches!(rx.recv().unwrap(), Action::Move(1)));
        key(0x26, WM_KEYDOWN);
        assert!(matches!(rx.recv().unwrap(), Action::Move(-1)));
        key(0x12, WM_SYSKEYUP);
        assert!(matches!(rx.recv().unwrap(), Action::Commit));
        key(0x12, WM_SYSKEYUP);
        assert!(rx.try_recv().is_err());
        ACTIVE.store(true, Ordering::SeqCst);
        key(0x1B, WM_KEYDOWN);
        assert!(matches!(rx.recv().unwrap(), Action::Cancel));
    }
}
