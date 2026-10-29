use super::{
    checked_len, clip_rect, Capabilities, CaptureError, CaptureMode, CaptureRequest, Frame,
    Permission,
};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::{Dwm::*, Gdi::*},
    System::Threading::GetCurrentProcessId,
    UI::{Accessibility::*, WindowsAndMessaging::*},
};
static LAST: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
fn external(hwnd: HWND) -> bool {
    unsafe {
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        !hwnd.is_null()
            && pid != GetCurrentProcessId()
            && IsWindowVisible(hwnd) != 0
            && IsIconic(hwnd) == 0
    }
}
unsafe extern "system" fn foreground_changed(
    _: HWINEVENTHOOK,
    _: u32,
    hwnd: HWND,
    _: i32,
    _: i32,
    _: u32,
    _: u32,
) {
    if external(hwnd) {
        LAST.store(hwnd as usize, std::sync::atomic::Ordering::Relaxed);
    }
}
pub fn track() {
    std::thread::spawn(|| unsafe {
        let hwnd = GetForegroundWindow();
        if external(hwnd) {
            LAST.store(hwnd as usize, std::sync::atomic::Ordering::Relaxed);
        }
        // Observe foreground transitions; never poll, inject input, or activate another application.
        let hook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            std::ptr::null_mut(),
            Some(foreground_changed),
            0,
            0,
            WINEVENT_SKIPOWNPROCESS,
        );
        if hook.is_null() {
            return;
        }
        let mut message: MSG = std::mem::zeroed();
        while GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        UnhookWinEvent(hook);
    });
}
pub fn target() -> Result<usize, CaptureError> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if external(hwnd) {
            Ok(hwnd as usize)
        } else {
            Ok(LAST.load(std::sync::atomic::Ordering::Relaxed))
        }
    }
}
pub fn capture(request: CaptureRequest) -> Result<Frame, CaptureError> {
    let mode = request.mode;
    let target = request.target;
    unsafe {
        let (mut x, mut y, mut width, mut height) = if mode == CaptureMode::Window {
            let hwnd = target as HWND;
            if !external(hwnd) {
                return Err(CaptureError::TargetUnavailable);
            }
            let mut r: RECT = std::mem::zeroed();
            if DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS as u32,
                &mut r as *mut _ as _,
                std::mem::size_of::<RECT>() as u32,
            ) != 0
                && GetWindowRect(hwnd, &mut r) == 0
            {
                return Err(CaptureError::Native);
            }
            (
                r.left,
                r.top,
                r.right
                    .checked_sub(r.left)
                    .ok_or(CaptureError::InvalidBounds)?,
                r.bottom
                    .checked_sub(r.top)
                    .ok_or(CaptureError::InvalidBounds)?,
            )
        } else {
            (
                GetSystemMetrics(SM_XVIRTUALSCREEN),
                GetSystemMetrics(SM_YVIRTUALSCREEN),
                GetSystemMetrics(SM_CXVIRTUALSCREEN),
                GetSystemMetrics(SM_CYVIRTUALSCREEN),
            )
        };
        let bounds = clip_rect(
            [x, y, width, height],
            [
                GetSystemMetrics(SM_XVIRTUALSCREEN),
                GetSystemMetrics(SM_YVIRTUALSCREEN),
                GetSystemMetrics(SM_CXVIRTUALSCREEN),
                GetSystemMetrics(SM_CYVIRTUALSCREEN),
            ],
        )?;
        [x, y, width, height] = bounds;
        let length = checked_len(width as u32, height as u32)?;
        // Wait for the hide operation to reach the compositor, rather than guessing a delay.
        let _ = DwmFlush();
        let source = GetDC(std::ptr::null_mut());
        if source.is_null() {
            return Err(CaptureError::Native);
        }
        let dc = CreateCompatibleDC(source);
        if dc.is_null() {
            ReleaseDC(std::ptr::null_mut(), source);
            return Err(CaptureError::Native);
        }
        let bitmap = CreateCompatibleBitmap(source, width, height);
        if bitmap.is_null() {
            DeleteDC(dc);
            ReleaseDC(std::ptr::null_mut(), source);
            return Err(CaptureError::Native);
        }
        let old = SelectObject(dc, bitmap);
        let copied = BitBlt(dc, 0, 0, width, height, source, x, y, SRCCOPY | CAPTUREBLT);
        SelectObject(dc, old);
        let mut info: BITMAPINFO = std::mem::zeroed();
        info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        info.bmiHeader.biWidth = width;
        info.bmiHeader.biHeight = -height;
        info.bmiHeader.biPlanes = 1;
        info.bmiHeader.biBitCount = 32;
        info.bmiHeader.biCompression = BI_RGB;
        let mut rgba = vec![0; length];
        let lines = if copied != 0 {
            GetDIBits(
                dc,
                bitmap,
                0,
                height as u32,
                rgba.as_mut_ptr() as _,
                &mut info,
                DIB_RGB_COLORS,
            )
        } else {
            0
        };
        DeleteObject(bitmap);
        DeleteDC(dc);
        ReleaseDC(std::ptr::null_mut(), source);
        if lines != height {
            return Err(CaptureError::Native);
        }
        for pixel in rgba.chunks_exact_mut(4) {
            pixel.swap(0, 2);
            pixel[3] = 255;
        }
        Frame::new(x, y, width as u32, height as u32, rgba)
    }
}

pub fn capabilities() -> Capabilities {
    Capabilities {
        platform: "windows".into(),
        supported: true,
        permission: Permission::NotRequired,
        reason: None,
        window_semantics: "visible_pixels".into(),
    }
}
pub fn request_permission() -> Result<(), CaptureError> {
    Ok(())
}
pub fn open_permissions() -> Result<(), CaptureError> {
    Err(CaptureError::Unsupported)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_window_is_rejected_without_input_or_capture() {
        assert!(matches!(
            capture(CaptureRequest {
                mode: CaptureMode::Window,
                target: 0
            }),
            Err(CaptureError::TargetUnavailable)
        ));
    }
}
