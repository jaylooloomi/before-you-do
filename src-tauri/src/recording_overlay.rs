//! Recording-only border and toolbar. Never reuse the frozen region selector.
use tauri::Manager;
pub fn show(app: &tauri::AppHandle, rect: [i32; 4]) -> Result<(), String> {
    if std::env::args().any(|a| a == "--recording-test")
        && !std::env::args().any(|a| a == "--recording-ui-test")
    {
        return Ok(());
    }
    let handle = app.clone();
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = tx.send(show_ui(&handle, rect));
    })
    .map_err(|e| e.to_string())?;
    rx.recv_timeout(std::time::Duration::from_secs(10))
        .map_err(|e| e.to_string())?
}
fn show_ui(app: &tauri::AppHandle, rect: [i32; 4]) -> Result<(), String> {
    #[cfg(windows)]
    native::show(rect)?;
    let bar = app
        .get_webview_window("recording-controls")
        .ok_or("Recording controls unavailable")?;
    let center = tauri::PhysicalPosition::new(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2);
    let monitor = bar
        .monitor_from_point(center.x as f64, center.y as f64)
        .map_err(|e| e.to_string())?
        .or(bar.primary_monitor().map_err(|e| e.to_string())?)
        .ok_or("Recording monitor unavailable")?;
    let work = monitor.work_area();
    let scale = monitor.scale_factor();
    let width = (380.0 * scale).round() as i32;
    let height = (42.0 * scale).round() as i32;
    let [x, y] = toolbar_position(
        rect,
        [
            work.position.x,
            work.position.y,
            work.size.width as i32,
            work.size.height as i32,
        ],
        width,
        height,
    );
    bar.set_size(tauri::PhysicalSize::new(width as u32, height as u32))
        .map_err(|e| e.to_string())?;
    bar.set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        let hwnd = bar.hwnd().map_err(|e| e.to_string())?.0 as _;
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(
            hwnd,
            GWL_EXSTYLE,
            style | WS_EX_NOACTIVATE as isize | WS_EX_TOOLWINDOW as isize,
        );
        if SetWindowDisplayAffinity(hwnd, 0x11) == 0 {
            return Err("Cannot exclude recording toolbar from capture".into());
        }
    }
    bar.show().map_err(|e| e.to_string())?;
    Ok(())
}
pub fn hide(app: &tauri::AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(bar) = handle.get_webview_window("recording-controls") {
            let _ = bar.hide();
        }
        #[cfg(windows)]
        native::hide();
    });
}
pub fn paused(paused: bool) {
    #[cfg(windows)]
    native::PAUSED.store(paused, std::sync::atomic::Ordering::SeqCst);
    #[cfg(not(windows))]
    let _ = paused;
}
#[tauri::command]
pub async fn preview_recording_overlay(
    w: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    if w.label() != "main"
        || !app.state::<crate::State>().preview
        || !std::env::args().any(|a| a == "--recording-ui-test")
    {
        return Err("Recording UI audit mode required".into());
    }
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    let handle = app.clone();
    app.run_on_main_thread(move || {
        #[cfg(windows)]
        let result = native::audit(&handle);
        #[cfg(not(windows))]
        let result = Err("Windows only".to_string());
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || rx.recv().map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
        .and_then(|r| r)
}
pub fn toolbar_position(rect: [i32; 4], work: [i32; 4], width: i32, height: i32) -> [i32; 2] {
    let [x, y, w, h] = rect;
    let [wx, wy, ww, wh] = work;
    let left = (x + w / 2 - width / 2).clamp(wx, wx + (ww - width).max(0));
    let below = y.saturating_add(h).saturating_add(4);
    let top = if below.saturating_add(height) <= wy + wh {
        below
    } else if y - height - 4 >= wy {
        y - height - 4
    } else {
        wy + wh - height
    };
    [left, top.clamp(wy, wy + (wh - height).max(0))]
}
#[cfg(windows)]
mod native {
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    };
    use windows_sys::Win32::{
        Foundation::*, Graphics::Gdi::*, System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::*,
    };
    static WINDOW: Mutex<usize> = Mutex::new(0);
    pub static PAUSED: AtomicBool = AtomicBool::new(false);
    unsafe extern "system" fn proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
        match msg {
            WM_NCHITTEST => HTTRANSPARENT as isize,
            WM_MOUSEACTIVATE => MA_NOACTIVATE as isize,
            WM_TIMER => {
                InvalidateRect(hwnd, std::ptr::null(), 0);
                0
            }
            WM_ERASEBKGND => 1,
            WM_PAINT => {
                let mut ps: PAINTSTRUCT = std::mem::zeroed();
                let dc = BeginPaint(hwnd, &mut ps);
                let mut rect: RECT = std::mem::zeroed();
                GetClientRect(hwnd, &mut rect);
                let base = CreateSolidBrush(0x00151515);
                FillRect(dc, &rect, base);
                DeleteObject(base as _);
                let color = if PAUSED.load(Ordering::SeqCst) {
                    0x0000c8ff
                } else {
                    0x003bff55
                };
                let pen = CreatePen(PS_SOLID, 1, color);
                let old = SelectObject(dc, pen as _);
                let offset = (GetMessageTime() / 120).rem_euclid(10);
                for edge in 0..2 {
                    let start = if edge == 0 { 0 } else { rect.right - 1 };
                    for y in (0..rect.bottom).step_by(10) {
                        MoveToEx(dc, start, y + offset, std::ptr::null_mut());
                        LineTo(dc, start, (y + offset + 5).min(rect.bottom));
                    }
                }
                for edge in 0..2 {
                    let top = if edge == 0 { 0 } else { rect.bottom - 1 };
                    for x in (0..rect.right).step_by(10) {
                        MoveToEx(dc, x + offset, top, std::ptr::null_mut());
                        LineTo(dc, (x + offset + 5).min(rect.right), top);
                    }
                }
                SelectObject(dc, old);
                DeleteObject(pen as _);
                EndPaint(hwnd, &ps);
                0
            }
            _ => DefWindowProcW(hwnd, msg, wp, lp),
        }
    }
    pub fn show(rect: [i32; 4]) -> Result<(), String> {
        unsafe {
            hide();
            PAUSED.store(false, Ordering::SeqCst);
            let class: Vec<u16> = "BeforeYouDoRecordingBorder\0".encode_utf16().collect();
            let instance = GetModuleHandleW(std::ptr::null());
            let mut wc: WNDCLASSW = std::mem::zeroed();
            wc.lpfnWndProc = Some(proc);
            wc.hInstance = instance;
            wc.lpszClassName = class.as_ptr();
            RegisterClassW(&wc);
            let [x, y, w, h] = rect;
            let hwnd = CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_LAYERED,
                class.as_ptr(),
                class.as_ptr(),
                WS_POPUP,
                x - 2,
                y - 2,
                w + 4,
                h + 4,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                instance,
                std::ptr::null(),
            );
            if hwnd.is_null() {
                return Err("Cannot create recording border".into());
            }
            SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
            let outer = CreateRectRgn(0, 0, w + 4, h + 4);
            let inner = CreateRectRgn(2, 2, w + 2, h + 2);
            CombineRgn(outer, outer, inner, RGN_DIFF);
            DeleteObject(inner as _);
            if SetWindowRgn(hwnd, outer, 1) == 0 {
                DeleteObject(outer as _);
                DestroyWindow(hwnd);
                return Err("Cannot shape recording border".into());
            }
            if SetWindowDisplayAffinity(hwnd, 0x11) == 0 {
                DestroyWindow(hwnd);
                return Err("Cannot exclude recording border from capture".into());
            }
            *WINDOW.lock().unwrap() = hwnd as usize;
            SetTimer(hwnd, 1, 120, None);
            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                x - 2,
                y - 2,
                w + 4,
                h + 4,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
            UpdateWindow(hwnd);
            Ok(())
        }
    }
    pub fn hide() {
        unsafe {
            let mut window = WINDOW.lock().unwrap();
            if *window != 0 {
                KillTimer(*window as HWND, 1);
                DestroyWindow(*window as HWND);
                *window = 0;
            }
        }
    }
    pub fn audit(app: &tauri::AppHandle) -> Result<serde_json::Value, String> {
        unsafe {
            use tauri::Manager;
            let hwnd = *WINDOW.lock().unwrap() as HWND;
            if hwnd.is_null() {
                return Ok(serde_json::json!({"visible":false}));
            }
            UpdateWindow(hwnd);
            let mut rect: RECT = std::mem::zeroed();
            GetWindowRect(hwnd, &mut rect);
            let mut affinity = 0;
            GetWindowDisplayAffinity(hwnd, &mut affinity);
            let dc = GetWindowDC(hwnd);
            let mut green = 0;
            let mut yellow = 0;
            for x in 0..(rect.right - rect.left) {
                let color = GetPixel(dc, x, 0);
                if color == 0x003bff55 {
                    green += 1;
                }
                if color == 0x0000c8ff {
                    yellow += 1;
                }
            }
            ReleaseDC(hwnd, dc);
            let bar = app
                .get_webview_window("recording-controls")
                .ok_or("No toolbar")?;
            let mut bar_affinity = 0;
            let bar_hwnd = bar.hwnd().map_err(|e| e.to_string())?.0 as _;
            GetWindowDisplayAffinity(bar_hwnd, &mut bar_affinity);
            let mut bar_rect: RECT = std::mem::zeroed();
            GetWindowRect(bar_hwnd, &mut bar_rect);
            Ok(
                serde_json::json!({"visible":IsWindowVisible(hwnd)!=0,"bounds":[rect.left,rect.top,rect.right-rect.left,rect.bottom-rect.top],"passthrough":GetWindowLongPtrW(hwnd,GWL_EXSTYLE)&WS_EX_TRANSPARENT as isize!=0,"affinity":affinity,"greenPixels":green,"yellowPixels":yellow,"toolbarVisible":bar.is_visible().map_err(|e|e.to_string())?,"toolbarAffinity":bar_affinity,"toolbarBounds":[bar_rect.left,bar_rect.top,bar_rect.right-bar_rect.left,bar_rect.bottom-bar_rect.top]}),
            )
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn toolbar_clamps_negative_monitors_and_fullscreen() {
        assert_eq!(
            toolbar_position([-1900, 50, 400, 300], [-1920, 0, 1920, 1040], 380, 42),
            [-1890, 354]
        );
        let p = toolbar_position([-1920, 0, 1920, 1080], [-1920, 0, 1920, 1040], 380, 42);
        assert!(p[0] >= -1920 && p[0] + 380 <= 0);
        assert!(p[1] >= 0 && p[1] + 42 <= 1040);
    }
}
