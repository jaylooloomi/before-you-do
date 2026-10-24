use super::{Action, Sender};
use std::{
    ffi::{c_char, c_void},
    sync::{
        atomic::{AtomicBool, AtomicPtr, Ordering},
        OnceLock,
    },
    time::Duration,
};
type Ptr = *mut c_void;
static TX: OnceLock<Sender<Action>> = OnceLock::new();
static ACTIVE: AtomicBool = AtomicBool::new(false);
static STARTED: AtomicBool = AtomicBool::new(false);
static TAP: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
const OPTION: u64 = 1 << 19;
const COMMAND: u64 = 1 << 20;
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        mask: u64,
        callback: extern "C" fn(Ptr, u32, Ptr, Ptr) -> Ptr,
        info: Ptr,
    ) -> Ptr;
    fn CGEventTapEnable(tap: Ptr, enable: bool);
    fn CGEventGetIntegerValueField(event: Ptr, field: u32) -> i64;
    fn CGEventGetFlags(event: Ptr) -> u64;
    fn CGEventSourceKeyState(state: i32, key: u16) -> bool;
    fn CGEventCreateKeyboardEvent(source: Ptr, key: u16, down: bool) -> Ptr;
    fn CGEventSetFlags(event: Ptr, flags: u64);
    fn CGEventPost(tap: u32, event: Ptr);
}
#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFMachPortCreateRunLoopSource(allocator: Ptr, port: Ptr, order: isize) -> Ptr;
    fn CFRunLoopGetCurrent() -> Ptr;
    fn CFRunLoopAddSource(runloop: Ptr, source: Ptr, mode: Ptr);
    fn CFRunLoopRun();
    fn CFRelease(value: Ptr);
    static kCFRunLoopCommonModes: Ptr;
}
#[link(name = "AppKit", kind = "framework")]
extern "C" {}
#[link(name = "objc")]
extern "C" {
    fn objc_getClass(name: *const c_char) -> Ptr;
    fn sel_registerName(name: *const c_char) -> Ptr;
    fn objc_msgSend();
    fn objc_autoreleasePoolPush() -> Ptr;
    fn objc_autoreleasePoolPop(pool: Ptr);
}
fn frontmost() -> usize {
    unsafe {
        let pool = objc_autoreleasePoolPush();
        let send: unsafe extern "C" fn(Ptr, Ptr) -> Ptr =
            std::mem::transmute(objc_msgSend as unsafe extern "C" fn());
        let pid: unsafe extern "C" fn(Ptr, Ptr) -> i32 =
            std::mem::transmute(objc_msgSend as unsafe extern "C" fn());
        let workspace = send(
            objc_getClass(c"NSWorkspace".as_ptr()),
            sel_registerName(c"sharedWorkspace".as_ptr()),
        );
        let app = send(
            workspace,
            sel_registerName(c"frontmostApplication".as_ptr()),
        );
        let result = pid(app, sel_registerName(c"processIdentifier".as_ptr())) as usize;
        objc_autoreleasePoolPop(pool);
        result
    }
}
fn send(action: Action) {
    if let Some(tx) = TX.get() {
        let _ = tx.send(action);
    }
}
extern "C" fn event_callback(_: Ptr, kind: u32, event: Ptr, _: Ptr) -> Ptr {
    unsafe {
        if kind == 0xFFFFFFFE || kind == 0xFFFFFFFF {
            ACTIVE.store(false, Ordering::SeqCst);
            send(Action::Cancel);
            let tap = TAP.load(Ordering::SeqCst);
            if !tap.is_null() {
                CGEventTapEnable(tap, true);
            }
            return event;
        }
        let key = CGEventGetIntegerValueField(event, 9) as u16;
        let flags = CGEventGetFlags(event);
        if kind == 10 && key == 4 && flags & OPTION != 0 && flags & COMMAND == 0 {
            if CGEventGetIntegerValueField(event, 8) == 0 {
                if ACTIVE.fetch_xor(true, Ordering::SeqCst) {
                    send(Action::Cancel);
                } else {
                    send(Action::Begin(frontmost()));
                }
            }
            return std::ptr::null_mut();
        }
        if ACTIVE.load(Ordering::SeqCst) {
            if kind == 12 && flags & OPTION == 0 {
                ACTIVE.store(false, Ordering::SeqCst);
                send(Action::Commit);
            } else if key == 125 || key == 126 {
                if kind == 10 {
                    send(Action::Move(if key == 126 { -1 } else { 1 }));
                    return std::ptr::null_mut();
                }
            } else if key == 53 {
                if kind == 10 {
                    ACTIVE.store(false, Ordering::SeqCst);
                    send(Action::Cancel);
                }
                return std::ptr::null_mut();
            } else if key == 4 && kind == 10 {
                return std::ptr::null_mut();
            }
        }
        event
    }
}
pub fn start(tx: Sender<Action>) -> Result<(), String> {
    unsafe {
        if !AXIsProcessTrusted() {
            return Err("macOS 需要「輔助使用」權限才能貼入其他程式。請在系統設定 → 隱私權與安全性中允許 Before You Do，必要時也允許「輸入監控」，再重新啟用。".into());
        }
        if STARTED.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let _ = TX.set(tx);
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let tap = CGEventTapCreate(
                1,
                0,
                0,
                (1 << 10) | (1 << 11) | (1 << 12),
                event_callback,
                std::ptr::null_mut(),
            );
            if tap.is_null() {
                STARTED.store(false, Ordering::SeqCst);
                let _ = ready_tx.send(Err(
                    "無法監聽 Option+H，請允許輔助使用與輸入監控權限後重試。".into(),
                ));
                return;
            }
            let source = CFMachPortCreateRunLoopSource(std::ptr::null_mut(), tap, 0);
            if source.is_null() {
                CFRelease(tap);
                STARTED.store(false, Ordering::SeqCst);
                let _ = ready_tx.send(Err("無法建立鍵盤事件來源。".into()));
                return;
            }
            TAP.store(tap, Ordering::SeqCst);
            CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
            CGEventTapEnable(tap, true);
            let _ = ready_tx.send(Ok(()));
            CFRunLoopRun();
            TAP.store(std::ptr::null_mut(), Ordering::SeqCst);
            CFRelease(source);
            CFRelease(tap);
            STARTED.store(false, Ordering::SeqCst);
            send(Action::Error("鍵盤監聽已停止。".into()));
        });
        ready_rx
            .recv_timeout(Duration::from_secs(5))
            .map_err(|e| e.to_string())?
    }
}
pub fn paste(target: usize, text: &str) -> Result<(), String> {
    unsafe {
        for _ in 0..60 {
            if frontmost() != target {
                return Err("已切換程式，這次貼入已取消。".into());
            }
            if ![58, 61, 4, 55, 54, 56, 60, 59, 62]
                .iter()
                .any(|key| CGEventSourceKeyState(1, *key))
            {
                let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
                clipboard.set_text(text).map_err(|e| e.to_string())?;
                if frontmost() != target {
                    return Err("已切換程式，這次貼入已取消。".into());
                }
                let down = CGEventCreateKeyboardEvent(std::ptr::null_mut(), 9, true);
                let up = CGEventCreateKeyboardEvent(std::ptr::null_mut(), 9, false);
                if down.is_null() || up.is_null() {
                    if !down.is_null() {
                        CFRelease(down);
                    }
                    if !up.is_null() {
                        CFRelease(up);
                    }
                    return Err("無法建立貼上事件。".into());
                }
                CGEventSetFlags(down, COMMAND);
                CGEventSetFlags(up, COMMAND);
                CGEventPost(0, down);
                CGEventPost(0, up);
                CFRelease(down);
                CFRelease(up);
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        Err("按鍵仍被按住，這次貼入已取消。".into())
    }
}
