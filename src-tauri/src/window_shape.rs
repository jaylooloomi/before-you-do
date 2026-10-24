//! Clip the native HWND, not just the HTML surface. Windows owns a successful region.
#[cfg(windows)]
pub fn apply(window: &tauri::WebviewWindow) -> Result<bool, String> {
    use std::sync::{Mutex, OnceLock};
    use windows_sys::Win32::{
        Foundation::{POINT, RECT},
        Graphics::{Dwm::*, Gdi::*},
        UI::WindowsAndMessaging::*,
    };
    static LAST: OnceLock<Mutex<std::collections::HashMap<usize, (i32, i32, i32)>>> =
        OnceLock::new();
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as _;
    let maximized = unsafe { IsZoomed(hwnd) != 0 };
    let mut rect: RECT = unsafe { std::mem::zeroed() };
    if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
        return Err("無法讀取視窗範圍".into());
    }
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;
    if width <= 0 || height <= 0 {
        return Ok(maximized);
    }
    // Undecorated, resizable HWNDs still have a non-client resize frame on
    // Windows 10. Clip to the WebView's client surface, not GetWindowRect:
    // including that frame exposes a bright strip outside the HTML corners.
    let mut client: RECT = unsafe { std::mem::zeroed() };
    let mut origin = POINT { x: 0, y: 0 };
    unsafe {
        if GetClientRect(hwnd, &mut client) == 0 || ClientToScreen(hwnd, &mut origin) == 0 {
            return Err("無法讀取視窗內容範圍".into());
        }
    }
    let left = origin.x - rect.left;
    let top = origin.y - rect.top;
    let right = left + client.right;
    let bottom = top + client.bottom;
    let radius = if maximized {
        0
    } else {
        (18.0 * window.scale_factor().map_err(|e| e.to_string())?).round() as i32
    };
    let mut last = LAST
        .get_or_init(|| Mutex::new(Default::default()))
        .lock()
        .unwrap();
    if last.get(&(hwnd as usize)) == Some(&(width, height, radius)) {
        return Ok(maximized);
    }
    // Native frame messages can re-enter the resize listener; never hold this lock there.
    last.insert(hwnd as usize, (width, height, radius));
    drop(last);
    unsafe {
        // DWMWA_BORDER_COLOR / DWMWA_COLOR_NONE (Windows 11); older Windows
        // ignores this, while the client-only region below handles its frame.
        let no_border: u32 = 0xfffffffe;
        let _ = DwmSetWindowAttribute(hwnd, 34, &no_border as *const _ as _, 4);
        let preference: u32 = if maximized { 1 } else { 2 };
        let _ = DwmSetWindowAttribute(hwnd, 33, &preference as *const _ as _, 4);
        let region = if maximized {
            std::ptr::null_mut()
        } else {
            CreateRoundRectRgn(left, top, right + 1, bottom + 1, radius * 2, radius * 2)
        };
        if !maximized && region.is_null() {
            return Err("無法建立視窗圓角".into());
        }
        if SetWindowRgn(hwnd, region, 1) == 0 {
            if !region.is_null() {
                DeleteObject(region);
            }
            return Err("無法套用視窗圓角".into());
        }
    }
    Ok(maximized)
}

#[cfg(not(windows))]
pub fn apply(window: &tauri::WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn inspect(window: &tauri::WebviewWindow) -> serde_json::Value {
    use windows_sys::Win32::{
        Foundation::{POINT, RECT},
        Graphics::Gdi::*,
        UI::WindowsAndMessaging::*,
    };
    let Ok(handle) = window.hwnd() else {
        return serde_json::json!({"error":"No HWND"});
    };
    unsafe {
        let hwnd = handle.0 as _;
        let mut rect: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut rect);
        let (w, h) = (rect.right - rect.left, rect.bottom - rect.top);
        let region = CreateRectRgn(0, 0, 0, 0);
        let kind = GetWindowRgn(hwnd, region);
        let corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
            .map(|(x, y)| PtInRegion(region, x, y) != 0);
        let center = PtInRegion(region, w / 2, h / 2) != 0;
        let mut bounds: RECT = std::mem::zeroed();
        GetRgnBox(region, &mut bounds);
        let mut client: RECT = std::mem::zeroed();
        let mut origin = POINT { x: 0, y: 0 };
        GetClientRect(hwnd, &mut client);
        ClientToScreen(hwnd, &mut origin);
        let x = origin.x - rect.left;
        let y = origin.y - rect.top;
        let client_corners = [
            (x, y),
            (x + client.right - 1, y),
            (x, y + client.bottom - 1),
            (x + client.right - 1, y + client.bottom - 1),
        ]
        .map(|(px, py)| PtInRegion(region, px, py) != 0);
        let frame_excluded = bounds.left == x
            && bounds.top == y
            && bounds.right <= x + client.right + 1
            && bounds.bottom <= y + client.bottom + 1;
        DeleteObject(region);
        let maximized = IsZoomed(hwnd) != 0;
        let mut monitor: MONITORINFO = std::mem::zeroed();
        monitor.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        let info_ok = GetMonitorInfoW(
            MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST),
            &mut monitor,
        ) != 0;
        let covers_work_area = info_ok
            && origin.x <= monitor.rcWork.left
            && origin.y <= monitor.rcWork.top
            && origin.x + client.right >= monitor.rcWork.right
            && origin.y + client.bottom >= monitor.rcWork.bottom;
        serde_json::json!({"label":window.label(),"width":w,"height":h,"region_kind":kind,"corners_inside":corners,"client_corners_inside":client_corners,"center_inside":center,"rounded":kind==3 && !client_corners.iter().any(|v|*v) && center,"client_rect":[x,y,client.right,client.bottom],"clip_bounds":[bounds.left,bounds.top,bounds.right,bounds.bottom],"non_client_frame_excluded":frame_excluded,"maximized":maximized,"client_covers_work_area":covers_work_area})
    }
}
