use super::{Action, Sender};
use crate::shortcut::Shortcut;
use std::{
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        mpsc, Mutex, OnceLock,
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
static CONFIG: AtomicU32 = AtomicU32::new((1 << 16) | 0x48);
static THREAD_ID: AtomicU32 = AtomicU32::new(0);
static CHANGE_LOCK: Mutex<()> = Mutex::new(());
static PENDING: Mutex<Option<(Shortcut, mpsc::SyncSender<Result<(), String>>)>> = Mutex::new(None);
const CHANGE_MESSAGE: u32 = WM_APP + 73;
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
    let packed = CONFIG.load(Ordering::SeqCst);
    let trigger = packed & 0xffff;
    let modifiers = packed >> 16;
    let mut repeated_h = false;
    if code >= 0 {
        let event = &*(lp as *const KBDLLHOOKSTRUCT);
        if event.vkCode == trigger {
            let up = wp as u32 == WM_KEYUP || wp as u32 == WM_SYSKEYUP;
            repeated_h = H_DOWN.swap(!up, Ordering::SeqCst) && !up;
        }
    }
    if code >= 0 && ACTIVE.load(Ordering::Relaxed) {
        let key = (*(lp as *const KBDLLHOOKSTRUCT)).vkCode;
        let up = wp as u32 == WM_KEYUP || wp as u32 == WM_SYSKEYUP;
        match key {
            key if (modifiers & MOD_ALT != 0 && [0x12, 0xA4, 0xA5].contains(&key))
                || (modifiers & MOD_CONTROL != 0 && [0x11, 0xA2, 0xA3].contains(&key))
                || (modifiers & MOD_SHIFT != 0 && [0x10, 0xA0, 0xA1].contains(&key)) =>
            {
                if up && ACTIVE.swap(false, Ordering::SeqCst) {
                    send(Action::Commit);
                }
            }
            0x25 | 0x27 => {
                if !up {
                    send(Action::Role(if key == 0x25 { -1 } else { 1 }));
                }
                return 1;
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
            key if key == trigger && !up => {
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
fn packed(shortcut: &Shortcut) -> u32 {
    (shortcut.windows_modifiers() << 16) | shortcut.windows_key()
}
unsafe fn modifiers_held(modifiers: u32) -> bool {
    [
        (MOD_ALT, VK_MENU),
        (MOD_CONTROL, VK_CONTROL),
        (MOD_SHIFT, VK_SHIFT),
    ]
    .iter()
    .all(|(mask, key)| modifiers & mask == 0 || GetAsyncKeyState(*key as i32) < 0)
}
pub fn configure(shortcut: Shortcut) -> Result<(), String> {
    shortcut.validate()?;
    let _guard = CHANGE_LOCK.lock().unwrap();
    let thread = THREAD_ID.load(Ordering::SeqCst);
    if !STARTED.load(Ordering::SeqCst) || thread == 0 {
        return Err("error.shortcut_unavailable".into());
    }
    let (tx, rx) = mpsc::sync_channel(1);
    *PENDING.lock().unwrap() = Some((shortcut, tx));
    if unsafe { PostThreadMessageW(thread, CHANGE_MESSAGE, 0, 0) } == 0 {
        PENDING.lock().unwrap().take();
        return Err("error.shortcut_unavailable".into());
    }
    rx.recv_timeout(Duration::from_secs(5))
        .map_err(|_| "error.shortcut_unavailable".to_string())?
}
pub fn start(tx: Sender<Action>, shortcut: Shortcut) -> Result<(), String> {
    shortcut.validate()?;
    if STARTED.swap(true, Ordering::SeqCst) {
        return configure(shortcut);
    }
    let _ = TX.set(tx);
    let (ready_tx, ready_rx) = mpsc::channel();
    std::thread::spawn(move || unsafe {
        let mut hotkey_id = 1;
        if RegisterHotKey(
            std::ptr::null_mut(),
            hotkey_id,
            shortcut.windows_modifiers() | MOD_NOREPEAT,
            shortcut.windows_key(),
        ) == 0
        {
            STARTED.store(false, Ordering::SeqCst);
            let _ = ready_tx.send(Err("error.shortcut_conflict".into()));
            return;
        }
        CONFIG.store(packed(&shortcut), Ordering::SeqCst);
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard),
            GetModuleHandleW(std::ptr::null()),
            0,
        );
        if hook.is_null() {
            UnregisterHotKey(std::ptr::null_mut(), hotkey_id);
            STARTED.store(false, Ordering::SeqCst);
            let _ = ready_tx.send(Err("error.shortcut_unavailable".into()));
            return;
        }
        let mut msg: MSG = std::mem::zeroed();
        // Ensure this worker has a message queue before accepting configuration changes.
        PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
        THREAD_ID.store(
            windows_sys::Win32::System::Threading::GetCurrentThreadId(),
            Ordering::SeqCst,
        );
        let _ = ready_tx.send(Ok(()));
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            if msg.message == CHANGE_MESSAGE {
                if let Some((candidate, reply)) = PENDING.lock().unwrap().take() {
                    if packed(&candidate) == CONFIG.load(Ordering::SeqCst) {
                        let _ = reply.send(Ok(()));
                        continue;
                    }
                    let next_id = if hotkey_id == 1 { 2 } else { 1 };
                    // Register the replacement first; a conflict leaves the old binding intact.
                    let result = if RegisterHotKey(
                        std::ptr::null_mut(),
                        next_id,
                        candidate.windows_modifiers() | MOD_NOREPEAT,
                        candidate.windows_key(),
                    ) == 0
                    {
                        Err("error.shortcut_conflict".into())
                    } else {
                        UnregisterHotKey(std::ptr::null_mut(), hotkey_id);
                        hotkey_id = next_id;
                        ACTIVE.store(false, Ordering::SeqCst);
                        H_DOWN.store(false, Ordering::SeqCst);
                        send(Action::Cancel);
                        CONFIG.store(packed(&candidate), Ordering::SeqCst);
                        Ok(())
                    };
                    let _ = reply.send(result);
                }
                continue;
            }
            if msg.message == WM_HOTKEY
                && msg.wParam == hotkey_id as usize
                && ((msg.lParam as u32 >> 16) & 0xffff) == (CONFIG.load(Ordering::SeqCst) & 0xffff)
                && (msg.lParam as u32 & 0xf) == (CONFIG.load(Ordering::SeqCst) >> 16)
                && !ACTIVE.swap(true, Ordering::SeqCst)
            {
                let target = GetForegroundWindow() as usize;
                if is_app_target(target) {
                    ACTIVE.store(false, Ordering::SeqCst);
                    send(Action::Dismiss);
                    continue;
                }
                send(Action::Begin(target));
                if !modifiers_held(CONFIG.load(Ordering::SeqCst) >> 16) {
                    ACTIVE.store(false, Ordering::SeqCst);
                    send(Action::Commit);
                }
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnhookWindowsHookEx(hook);
        UnregisterHotKey(std::ptr::null_mut(), hotkey_id);
        THREAD_ID.store(0, Ordering::SeqCst);
        STARTED.store(false, Ordering::SeqCst);
        send(Action::Error("error.shortcut_unavailable".into()));
    });
    ready_rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "error.shortcut_unavailable".to_string())?
}
pub fn paste(target: usize, text: &str) -> Result<(), String> {
    unsafe {
        crate::diagnostic(&format!(
            "paste target={target} foreground={} Alt={} H={} Ctrl={} Shift={}",
            GetForegroundWindow() as usize,
            GetAsyncKeyState(VK_MENU as i32) < 0,
            GetAsyncKeyState((CONFIG.load(Ordering::SeqCst) & 0xffff) as i32) < 0,
            GetAsyncKeyState(VK_CONTROL as i32) < 0,
            GetAsyncKeyState(VK_SHIFT as i32) < 0
        ));
        for _ in 0..60 {
            if GetForegroundWindow() as usize != target {
                return Err("已切換視窗，這次貼入已取消。".into());
            }
            if [
                VK_MENU,
                VK_CONTROL,
                VK_SHIFT,
                (CONFIG.load(Ordering::SeqCst) & 0xffff) as u16,
            ]
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
        // A changed trigger must replace H for cancellation and track repeats.
        for shortcut in [
            Shortcut {
                modifier: "alt".into(),
                key: "J".into(),
            },
            Shortcut {
                modifier: "ctrlShift".into(),
                key: "9".into(),
            },
            Shortcut {
                modifier: "ctrl".into(),
                key: "Space".into(),
            },
        ] {
            CONFIG.store(packed(&shortcut), Ordering::SeqCst);
            H_DOWN.store(false, Ordering::SeqCst);
            let trigger = shortcut.windows_key();
            key(trigger, WM_KEYDOWN);
            ACTIVE.store(true, Ordering::SeqCst);
            key(trigger, WM_KEYDOWN);
            assert!(ACTIVE.load(Ordering::SeqCst));
            key(trigger, WM_KEYUP);
            key(trigger, WM_KEYDOWN);
            assert!(matches!(rx.recv().unwrap(), Action::Cancel));
            ACTIVE.store(true, Ordering::SeqCst);
            let modifier = if shortcut.modifier.starts_with("ctrl") {
                0x11
            } else {
                0x12
            };
            key(modifier, WM_KEYUP);
            assert!(matches!(rx.recv().unwrap(), Action::Commit));
            key(modifier, WM_KEYUP);
            assert!(rx.try_recv().is_err());
        }
        CONFIG.store(packed(&Shortcut::default()), Ordering::SeqCst);
    }
    #[test]
    #[ignore = "Registers temporary native hotkeys; run alone on Windows"]
    fn native_shortcut_conflict_preserves_previous_registration() {
        let old = Shortcut {
            modifier: "altShift".into(),
            key: "9".into(),
        };
        let blocked = Shortcut {
            modifier: "ctrlShift".into(),
            key: "9".into(),
        };
        let next = Shortcut {
            modifier: "altShift".into(),
            key: "8".into(),
        };
        let (tx, _rx) = mpsc::channel();
        start(tx, old.clone()).unwrap();
        unsafe {
            assert_ne!(
                RegisterHotKey(
                    std::ptr::null_mut(),
                    700,
                    blocked.windows_modifiers() | MOD_NOREPEAT,
                    blocked.windows_key()
                ),
                0
            );
        }
        assert_eq!(configure(blocked).unwrap_err(), "error.shortcut_conflict");
        assert_eq!(CONFIG.load(Ordering::SeqCst), packed(&old));
        unsafe {
            assert_eq!(
                RegisterHotKey(
                    std::ptr::null_mut(),
                    701,
                    old.windows_modifiers() | MOD_NOREPEAT,
                    old.windows_key()
                ),
                0
            );
        }
        configure(next.clone()).unwrap();
        assert_eq!(CONFIG.load(Ordering::SeqCst), packed(&next));
        unsafe {
            assert_ne!(
                RegisterHotKey(
                    std::ptr::null_mut(),
                    701,
                    old.windows_modifiers() | MOD_NOREPEAT,
                    old.windows_key()
                ),
                0
            );
            UnregisterHotKey(std::ptr::null_mut(), 700);
            UnregisterHotKey(std::ptr::null_mut(), 701);
        }
    }
}

// Foreground handles are validated again after the manager has been hidden.
pub fn is_app_target(target: usize) -> bool {
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(target as HWND, &mut pid);
    }
    pid != 0 && pid == std::process::id()
}
pub fn foreground_target() -> Option<usize> {
    let target = unsafe { GetForegroundWindow() } as usize;
    (target != 0 && !is_app_target(target)).then_some(target)
}

pub fn cancel_selection() {
    ACTIVE.store(false, Ordering::SeqCst);
}
