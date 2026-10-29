use super::{
    checked_len, clip_rect, Candidate, CandidateKind, Capabilities, CaptureError, CaptureMode,
    CaptureRequest, Frame, Permission,
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
        let mut frame = Frame::new(x, y, width as u32, height as u32, rgba)?;
        if mode == CaptureMode::Region {
            frame.candidates = collect_candidates([x, y, width, height]);
        }
        Ok(frame)
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

const MAX_CANDIDATES: usize = 4096;
struct CandidateSnapshot {
    bounds: [i32; 4],
    items: Vec<Candidate>,
    next: u32,
    started: std::time::Instant,
}
impl CandidateSnapshot {
    fn available(&self) -> bool {
        self.items.len() < MAX_CANDIDATES
            && self.started.elapsed() < std::time::Duration::from_millis(300)
    }
    fn add(&mut self, parent: u32, group: u32, kind: CandidateKind, rect: [i32; 4]) -> Option<u32> {
        if !self.available() {
            return None;
        }
        let id = self.next;
        let candidate = Candidate::from_desktop(
            id,
            parent,
            if group == 0 { id } else { group },
            kind,
            rect,
            self.bounds,
        )?;
        self.next += 1;
        self.items.push(candidate);
        Some(id)
    }
}
unsafe fn ordinary_rect(hwnd: HWND) -> Option<[i32; 4]> {
    let mut r: RECT = std::mem::zeroed();
    if GetWindowRect(hwnd, &mut r) == 0 {
        return None;
    }
    Some([
        r.left,
        r.top,
        r.right.checked_sub(r.left)?,
        r.bottom.checked_sub(r.top)?,
    ])
}
unsafe fn client_rect(hwnd: HWND) -> Option<[i32; 4]> {
    let mut r: RECT = std::mem::zeroed();
    let mut p = POINT { x: 0, y: 0 };
    if GetClientRect(hwnd, &mut r) == 0 || ClientToScreen(hwnd, &mut p) == 0 {
        return None;
    }
    Some([
        p.x,
        p.y,
        r.right.checked_sub(r.left)?,
        r.bottom.checked_sub(r.top)?,
    ])
}
unsafe fn collect_children(
    parent_hwnd: HWND,
    parent: u32,
    group: u32,
    clip: [i32; 4],
    depth: usize,
    context: &mut CandidateSnapshot,
) {
    if depth >= 24 {
        return;
    }
    let mut child = GetTopWindow(parent_hwnd);
    let mut siblings = 0;
    while !child.is_null() && context.available() && siblings < 512 {
        siblings += 1;
        if IsWindowVisible(child) != 0
            && (GetWindowLongPtrW(child, GWL_STYLE) as u32 & WS_CHILD) != 0
        {
            if let Some(rect) = ordinary_rect(child).and_then(|r| clip_rect(r, clip).ok()) {
                if rect[2] >= 3 && rect[3] >= 3 {
                    if let Some(id) = context.add(parent, group, CandidateKind::Control, rect) {
                        let child_clip = client_rect(child)
                            .and_then(|r| clip_rect(r, rect).ok())
                            .unwrap_or(rect);
                        collect_children(child, id, group, child_clip, depth + 1, context);
                    }
                }
            }
        }
        child = GetWindow(child, GW_HWNDNEXT);
    }
}
unsafe extern "system" fn collect_top(hwnd: HWND, parameter: LPARAM) -> windows_sys::core::BOOL {
    let context = &mut *(parameter as *mut CandidateSnapshot);
    if !context.available() {
        return 0;
    }
    if !external(hwnd) {
        return 1;
    }
    let mut cloaked = 0u32;
    if DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED as u32, &mut cloaked as *mut _ as _, 4) == 0
        && cloaked != 0
    {
        return 1;
    }
    let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
    if style & WS_EX_TOOLWINDOW != 0 && style & WS_EX_NOACTIVATE != 0 {
        return 1;
    }
    let mut class = [0u16; 128];
    let count = GetClassNameW(hwnd, class.as_mut_ptr(), 128);
    let class = String::from_utf16_lossy(&class[..count.max(0) as usize]);
    if ["Tao Thread Event Target", "CEF-OSC-WIDGET", "SysShadow"]
        .iter()
        .any(|name| class.eq_ignore_ascii_case(name))
    {
        return 1;
    }
    let mut r: RECT = std::mem::zeroed();
    let bounds = if DwmGetWindowAttribute(
        hwnd,
        DWMWA_EXTENDED_FRAME_BOUNDS as u32,
        &mut r as *mut _ as _,
        std::mem::size_of::<RECT>() as u32,
    ) == 0
    {
        r.right
            .checked_sub(r.left)
            .zip(r.bottom.checked_sub(r.top))
            .map(|(w, h)| [r.left, r.top, w, h])
    } else {
        ordinary_rect(hwnd)
    };
    let Some(bounds) = bounds.and_then(|r| clip_rect(r, context.bounds).ok()) else {
        return 1;
    };
    let Some(root) = context.add(0, 0, CandidateKind::Window, bounds) else {
        return 1;
    };
    let client = client_rect(hwnd)
        .and_then(|r| clip_rect(r, bounds).ok())
        .unwrap_or(bounds);
    let parent = if client != bounds {
        context
            .add(root, root, CandidateKind::Client, client)
            .unwrap_or(root)
    } else {
        root
    };
    collect_children(hwnd, parent, root, client, 0, context);
    1
}
fn collect_candidates(bounds: [i32; 4]) -> Vec<Candidate> {
    let mut context = CandidateSnapshot {
        bounds,
        items: Vec::new(),
        next: 1,
        started: std::time::Instant::now(),
    };
    unsafe {
        EnumWindows(Some(collect_top), &mut context as *mut _ as LPARAM);
    }
    context.items
}
