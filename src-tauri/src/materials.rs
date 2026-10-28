use base64::Engine;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};
const MAX_FILE: usize = 25 * 1024 * 1024;
const MAX_TOTAL: u64 = 100 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub text: String,
    pub size: u64,
}
#[derive(Default, Clone, Serialize, Deserialize)]
pub struct Bundle {
    pub items: Vec<Item>,
}
pub struct Materials {
    load_error: Option<String>,
    root: PathBuf,
    bundle: Mutex<Bundle>,
    capture: Mutex<Option<Frame>>,
    pub busy: std::sync::atomic::AtomicBool,
}
impl Materials {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        let file = root.join("session.json");
        let loaded = if file.exists() {
            fs::read(file)
                .map_err(err)
                .and_then(|bytes| serde_json::from_slice::<Bundle>(&bytes).map_err(err))
                .and_then(validate_bundle)
        } else {
            Ok(Bundle::default())
        };
        let (bundle, load_error) = match loaded {
            Ok(bundle) => (bundle, None),
            Err(e) => (Bundle::default(), Some(e)),
        };
        Ok(Self {
            load_error,
            root,
            bundle: Mutex::new(bundle),
            capture: Mutex::new(None),
            busy: std::sync::atomic::AtomicBool::new(false),
        })
    }
    fn ready(&self) -> Result<(), String> {
        if let Some(e) = &self.load_error {
            Err(format!("Cannot read material session: {e}"))
        } else {
            Ok(())
        }
    }
    fn commit(&self, bundle: &Bundle) -> Result<(), String> {
        self.ready()?;
        fs::create_dir_all(&self.root).map_err(err)?;
        let tmp = self.root.join("session.json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(bundle).map_err(err)?).map_err(err)?;
        fs::rename(tmp, self.root.join("session.json")).map_err(err)
    }
    fn append(&self, item: Item, bytes: Option<&[u8]>) -> Result<Bundle, String> {
        let mut current = self.bundle.lock().map_err(err)?;
        if current.items.len() >= 100 {
            return Err("Maximum 100 materials".into());
        }
        if current.items.iter().map(|i| i.size).sum::<u64>() + item.size > MAX_TOTAL {
            return Err("Maximum total size is 100 MB".into());
        }
        if let Some(bytes) = bytes {
            fs::create_dir_all(self.root.join("files")).map_err(err)?;
            fs::write(self.asset(&item.id), bytes).map_err(err)?;
        }
        let mut next = current.clone();
        next.items.push(item.clone());
        if let Err(e) = self.commit(&next) {
            if bytes.is_some() {
                let _ = fs::remove_file(self.asset(&item.id));
            }
            return Err(e);
        }
        *current = next.clone();
        Ok(next)
    }
    fn asset(&self, id: &str) -> PathBuf {
        self.root.join("files").join(id)
    }
}
fn validate_name(name: &str) -> Result<(), String> {
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    if name.is_empty()
        || name.len() > 240
        || name.ends_with(['.', ' '])
        || name.chars().any(|c| c < ' ' || "<>:\"/\\|?*".contains(c))
        || [
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
            "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
        ]
        .contains(&stem.as_str())
    {
        Err("Invalid filename".into())
    } else {
        Ok(())
    }
}
fn validate_bundle(bundle: Bundle) -> Result<Bundle, String> {
    if bundle.items.len() > 100
        || bundle
            .items
            .iter()
            .try_fold(0u64, |sum, i| sum.checked_add(i.size))
            .is_none_or(|sum| sum > MAX_TOTAL)
    {
        return Err("Material limits exceeded".into());
    }
    let mut seen = std::collections::HashSet::new();
    for item in &bundle.items {
        if item.id.is_empty()
            || item.id.len() > 100
            || !item.id.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')
            || !seen.insert(&item.id)
            || !["text", "image", "file"].contains(&item.kind.as_str())
        {
            return Err("Invalid material record".into());
        }
        validate_name(&item.name)?;
        valid_text(&item.text)?;
    }
    Ok(bundle)
}
fn image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("image/webp")
    } else {
        None
    }
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn id() -> String {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    format!(
        "{:x}-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        std::process::id(),
        SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    )
}
fn manager(w: &tauri::WebviewWindow) -> Result<(), String> {
    if w.label() != "main" {
        Err("Manager only".into())
    } else {
        Ok(())
    }
}
fn valid_text(s: &str) -> Result<(), String> {
    if s.chars().count() > 100_000 {
        Err("Maximum 100000 characters".into())
    } else {
        Ok(())
    }
}
#[tauri::command]
pub fn materials_load(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
) -> Result<Bundle, String> {
    manager(&w)?;
    state.ready()?;
    Ok(state.bundle.lock().map_err(err)?.clone())
}
#[tauri::command]
pub fn materials_text(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
    item_id: Option<String>,
    text: String,
) -> Result<Bundle, String> {
    manager(&w)?;
    state.ready()?;
    valid_text(&text)?;
    if let Some(id) = item_id {
        let mut current = state.bundle.lock().map_err(err)?;
        let mut next = current.clone();
        let item = next
            .items
            .iter_mut()
            .find(|i| i.id == id && i.kind == "text")
            .ok_or("Text not found")?;
        item.text = text;
        state.commit(&next)?;
        *current = next.clone();
        Ok(next)
    } else {
        state.append(
            Item {
                id: id(),
                name: "Text".into(),
                kind: "text".into(),
                size: 0,
                text,
            },
            None,
        )
    }
}
#[tauri::command]
pub fn materials_import(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
    name: String,
    bytes: Vec<u8>,
) -> Result<Bundle, String> {
    manager(&w)?;
    state.ready()?;
    if bytes.len() > MAX_FILE {
        return Err("Maximum file size is 25 MB".into());
    }
    validate_name(&name)?;
    let kind = if image_mime(&bytes).is_some() {
        "image"
    } else {
        "file"
    };
    state.append(
        Item {
            id: id(),
            name,
            kind: kind.into(),
            text: String::new(),
            size: bytes.len() as u64,
        },
        Some(&bytes),
    )
}
#[tauri::command]
pub fn materials_order(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
    ids: Vec<String>,
) -> Result<Bundle, String> {
    manager(&w)?;
    state.ready()?;
    let mut current = state.bundle.lock().map_err(err)?;
    let next = reorder(&current, &ids)?;
    state.commit(&next)?;
    *current = next.clone();
    Ok(next)
}
fn reorder(current: &Bundle, ids: &[String]) -> Result<Bundle, String> {
    let unique: std::collections::HashSet<_> = ids.iter().collect();
    if ids.len() != current.items.len() || unique.len() != ids.len() {
        return Err("Invalid material order".into());
    }
    let items = ids
        .iter()
        .map(|id| {
            current
                .items
                .iter()
                .find(|i| &i.id == id)
                .cloned()
                .ok_or("Unknown material".to_string())
        })
        .collect::<Result<_, _>>()?;
    Ok(Bundle { items })
}
#[tauri::command]
pub fn materials_remove(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
    item_id: String,
) -> Result<Bundle, String> {
    manager(&w)?;
    state.ready()?;
    let mut current = state.bundle.lock().map_err(err)?;
    let mut next = current.clone();
    let index = next
        .items
        .iter()
        .position(|i| i.id == item_id)
        .ok_or("Material not found")?;
    let removed = next.items.remove(index);
    state.commit(&next)?;
    *current = next.clone();
    if removed.kind != "text" {
        let _ = fs::remove_file(state.asset(&removed.id));
    }
    Ok(next)
}
#[tauri::command]
pub fn materials_preview(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
    item_id: String,
) -> Result<String, String> {
    manager(&w)?;
    state.ready()?;
    let current = state.bundle.lock().map_err(err)?;
    let item = current
        .items
        .iter()
        .find(|i| i.id == item_id && i.kind == "image")
        .ok_or("Image not found")?;
    let bytes = fs::read(state.asset(&item.id)).map_err(err)?;
    Ok(format!(
        "data:{};base64,{}",
        image_mime(&bytes).ok_or("Unsupported image")?,
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}
#[tauri::command]
pub fn materials_export(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
) -> Result<String, String> {
    manager(&w)?;
    state.ready()?;
    export_bundle(&state)
}
fn export_bundle(state: &Materials) -> Result<String, String> {
    let current = state.bundle.lock().map_err(err)?;
    if current.items.is_empty() {
        return Err("No materials to export".into());
    }
    let key = id();
    let final_dir = state.root.join("exports").join(&key);
    let dir = state.root.join("exports").join(format!(".pending-{key}"));
    fs::create_dir_all(&dir).map_err(err)?;
    let mut prompt = String::new();
    for (n, item) in current.items.iter().enumerate() {
        if item.kind == "text" {
            prompt.push_str(&format!("{}\n\n", item.text));
        } else {
            let name = format!("{:02}-{}", n + 1, item.name);
            fs::copy(state.asset(&item.id), dir.join(&name)).map_err(err)?;
            prompt.push_str(&format!("[Attachment: {}]\n\n", name));
        }
    }
    fs::write(dir.join("prompt.md"), prompt).map_err(err)?;
    fs::write(
        dir.join("manifest.json"),
        serde_json::to_vec_pretty(&*current).map_err(err)?,
    )
    .map_err(err)?;
    fs::rename(&dir, &final_dir).map_err(err)?;
    Ok(final_dir.to_string_lossy().into_owned())
}
#[derive(Clone)]
pub struct Frame {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}
impl Frame {
    fn png(&self) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, self.width, self.height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().map_err(err)?;
            writer.write_image_data(&self.rgba).map_err(err)?;
        }
        Ok(bytes)
    }
    fn crop(&self, x: u32, y: u32, width: u32, height: u32) -> Result<Self, String> {
        if width == 0
            || height == 0
            || x.checked_add(width).is_none_or(|v| v > self.width)
            || y.checked_add(height).is_none_or(|v| v > self.height)
        {
            return Err("Invalid selection".into());
        }
        let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);
        for row in y..y + height {
            let start = ((row as usize * self.width as usize) + x as usize) * 4;
            rgba.extend_from_slice(&self.rgba[start..start + width as usize * 4]);
        }
        Ok(Self {
            x: self.x + x as i32,
            y: self.y + y as i32,
            width,
            height,
            rgba,
        })
    }
}
fn add_frame(state: &Materials, frame: Frame) -> Result<Bundle, String> {
    let bytes = frame.png()?;
    let key = id();
    state.append(
        Item {
            id: key.clone(),
            name: format!("capture-{key}.png"),
            kind: "image".into(),
            text: String::new(),
            size: bytes.len() as u64,
        },
        Some(&bytes),
    )
}
#[derive(Serialize)]
pub struct CaptureView {
    image: String,
    width: u32,
    height: u32,
}
#[tauri::command]
pub fn capture_frame(
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
) -> Result<CaptureView, String> {
    if w.label() != "capture" {
        return Err("Capture window only".into());
    }
    let guard = state.capture.lock().map_err(err)?;
    let f = guard.as_ref().ok_or("No capture")?;
    Ok(CaptureView {
        image: format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(f.png()?)
        ),
        width: f.width,
        height: f.height,
    })
}
pub fn cancel(app: &tauri::AppHandle) {
    let state = app.state::<Materials>();
    if let Ok(mut capture) = state.capture.lock() {
        capture.take();
    }
    state.busy.store(false, std::sync::atomic::Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.hide();
    }
    crate::manage(app);
}
#[tauri::command]
pub fn capture_finish(
    app: tauri::AppHandle,
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
    rect: Option<[u32; 4]>,
) -> Result<(), String> {
    if w.label() != "capture" {
        return Err("Capture window only".into());
    }
    if let Some([x, y, width, height]) = rect {
        let frame = state
            .capture
            .lock()
            .map_err(err)?
            .as_ref()
            .ok_or("No capture")?
            .crop(x, y, width, height)?;
        // Retain the frozen source and overlay on validation or disk errors so the user can retry.
        add_frame(&state, frame)?;
    }
    state.capture.lock().map_err(err)?.take();
    state.busy.store(false, std::sync::atomic::Ordering::SeqCst);
    let _ = w.hide();
    crate::manage(&app);
    let _ = app.emit_to("main", "materials-updated", ());
    Ok(())
}
#[tauri::command]
pub async fn capture_start(
    app: tauri::AppHandle,
    w: tauri::WebviewWindow,
    mode: String,
) -> Result<(), String> {
    manager(&w)?;
    if !["region", "fullscreen", "window"].contains(&mode.as_str()) {
        return Err("Invalid capture mode".into());
    }
    let state = app.state::<Materials>();
    state.ready()?;
    if state.busy.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return Err("Capture already in progress".into());
    }
    let region = mode == "region";
    let result = async {
        let target = native::target()?;
        w.hide().map_err(err)?;
        let frame = tauri::async_runtime::spawn_blocking(move || {
            std::thread::sleep(std::time::Duration::from_millis(250));
            native::capture(&mode, target)
        })
        .await
        .map_err(err)??;
        if region {
            let overlay = app
                .get_webview_window("capture")
                .ok_or("Capture window unavailable")?;
            overlay
                .set_position(tauri::PhysicalPosition::new(frame.x, frame.y))
                .map_err(err)?;
            overlay
                .set_size(tauri::PhysicalSize::new(frame.width, frame.height))
                .map_err(err)?;
            *state.capture.lock().map_err(err)? = Some(frame);
            // Freeze before showing the overlay. Never include the overlay in the capture.
            app.emit_to("capture", "capture-ready", ()).map_err(err)?;
            overlay.show().map_err(err)?;
            overlay.set_focus().map_err(err)?;
        } else {
            add_frame(&state, frame)?;
            app.emit_to("main", "materials-updated", ()).map_err(err)?;
        }
        Ok::<(), String>(())
    }
    .await;
    if !region || result.is_err() {
        state.capture.lock().map_err(err)?.take();
        state.busy.store(false, std::sync::atomic::Ordering::SeqCst);
        if let Some(overlay) = app.get_webview_window("capture") {
            let _ = overlay.hide();
        }
        crate::manage(&app);
    }
    result
}
#[cfg(windows)]
mod native {
    use super::*;
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
    pub fn target() -> Result<usize, String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if external(hwnd) {
                Ok(hwnd as usize)
            } else {
                Ok(LAST.load(std::sync::atomic::Ordering::Relaxed))
            }
        }
    }
    pub fn capture(mode: &str, target: usize) -> Result<Frame, String> {
        unsafe {
            let (mut x, mut y, mut width, mut height) = if mode == "window" {
                let hwnd = target as HWND;
                if !external(hwnd) {
                    return Err(
                        "Select another application window before opening the material area".into(),
                    );
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
                    return Err("Cannot read window bounds".into());
                }
                (r.left, r.top, r.right - r.left, r.bottom - r.top)
            } else {
                (
                    GetSystemMetrics(SM_XVIRTUALSCREEN),
                    GetSystemMetrics(SM_YVIRTUALSCREEN),
                    GetSystemMetrics(SM_CXVIRTUALSCREEN),
                    GetSystemMetrics(SM_CYVIRTUALSCREEN),
                )
            };
            if mode == "window" {
                let desktop_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
                let desktop_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
                let right = (x + width).min(desktop_x + GetSystemMetrics(SM_CXVIRTUALSCREEN));
                let bottom = (y + height).min(desktop_y + GetSystemMetrics(SM_CYVIRTUALSCREEN));
                x = x.max(desktop_x);
                y = y.max(desktop_y);
                width = right - x;
                height = bottom - y;
            }
            if width <= 0 || height <= 0 || width as u64 * height as u64 > 64_000_000 {
                return Err("Invalid or oversized capture bounds".into());
            }
            let source = GetDC(std::ptr::null_mut());
            if source.is_null() {
                return Err("Cannot access desktop".into());
            }
            let dc = CreateCompatibleDC(source);
            if dc.is_null() {
                ReleaseDC(std::ptr::null_mut(), source);
                return Err("Cannot allocate capture context".into());
            }
            let bitmap = CreateCompatibleBitmap(source, width, height);
            if bitmap.is_null() {
                DeleteDC(dc);
                ReleaseDC(std::ptr::null_mut(), source);
                return Err("Cannot allocate capture bitmap".into());
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
            let mut rgba = vec![0; width as usize * height as usize * 4];
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
                return Err("Desktop capture failed".into());
            }
            for pixel in rgba.chunks_exact_mut(4) {
                pixel.swap(0, 2);
                pixel[3] = 255;
            }
            Ok(Frame {
                x,
                y,
                width: width as u32,
                height: height as u32,
                rgba,
            })
        }
    }
}
#[cfg(not(windows))]
mod native {
    use super::*;
    pub fn track() {}
    pub fn target() -> Result<usize, String> {
        Err("Screen capture is currently available on Windows".into())
    }
    pub fn capture(_: &str, _: usize) -> Result<Frame, String> {
        Err("Screen capture is currently available on Windows".into())
    }
}
pub fn track() {
    native::track()
}
/// Explicit command-line audit: no app startup, UI input, clipboard or user settings writes.
pub fn audit(directory: &std::path::Path) -> Result<(), String> {
    fs::create_dir_all(directory).map_err(err)?;
    let frame = native::capture("fullscreen", 0)?;
    let png = frame.png()?;
    fs::write(directory.join("fullscreen.png"), &png).map_err(err)?;
    let crop = frame.crop(0, 0, frame.width.min(160), frame.height.min(120))?;
    fs::write(directory.join("region.png"), crop.png()?).map_err(err)?;
    let target = native::target()?;
    let window = native::capture("window", target)?;
    fs::write(directory.join("window.png"), window.png()?).map_err(err)?;
    let root = directory.join("isolated-materials");
    let store = Materials::new(root.clone())?;
    store.append(
        Item {
            id: id(),
            name: "test.txt".into(),
            kind: "file".into(),
            text: String::new(),
            size: 8,
        },
        Some(b"fixture!"),
    )?;
    add_frame(&store, crop)?;
    let export = PathBuf::from(export_bundle(&store)?);
    if !fs::read_to_string(export.join("prompt.md"))
        .map_err(err)?
        .contains("01-test.txt")
        || fs::read(export.join("01-test.txt")).map_err(err)? != b"fixture!"
    {
        return Err("Export verification failed".into());
    }
    let loaded = Materials::new(root)?;
    if loaded.bundle.lock().map_err(err)?.items.len() != 2 {
        return Err("Persistence verification failed".into());
    }
    let report = serde_json::json!({"fullscreen":[frame.x,frame.y,frame.width as i32,frame.height as i32],"window":[window.x,window.y,window.width as i32,window.height as i32],"region":[frame.width.min(160),frame.height.min(120)],"pngSignatureValid":png.starts_with(b"\x89PNG\r\n\x1a\n"),"persistedMaterials":2,"exportVerified":true,"systemInput":false});
    fs::write(
        directory.join("result.json"),
        serde_json::to_vec_pretty(&report).map_err(err)?,
    )
    .map_err(err)?;
    println!("{}", report);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn crop_pixels_and_reject_overflow() {
        let f = Frame {
            x: -4,
            y: 10,
            width: 2,
            height: 2,
            rgba: (0..16).collect(),
        };
        let c = f.crop(1, 0, 1, 2).unwrap();
        assert_eq!(c.rgba, vec![4, 5, 6, 7, 12, 13, 14, 15]);
        assert_eq!((c.x, c.y), (-3, 10));
        assert!(f.crop(u32::MAX, 0, 2, 2).is_err());
        assert!(f.crop(0, 0, 0, 1).is_err());
    }
    #[test]
    fn invalid_material_metadata_cannot_escape_storage_or_overwrite_files() {
        for name in [
            "../x",
            "x/y",
            "x\\y",
            "CON",
            "NUL.txt",
            "x:",
            "..",
            "trailing.",
        ] {
            assert!(validate_name(name).is_err(), "{name}")
        }
        let dir = std::env::temp_dir().join(id());
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("session.json");
        fs::write(&file, b"broken").unwrap();
        let store = Materials::new(dir.clone()).unwrap();
        assert!(store.ready().is_err());
        assert!(store.commit(&Bundle::default()).is_err());
        assert_eq!(fs::read(&file).unwrap(), b"broken");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn png_round_trip() {
        let f = Frame {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            rgba: vec![12, 34, 56, 255],
        };
        let data = f.png().unwrap();
        let mut reader = png::Decoder::new(std::io::Cursor::new(data))
            .read_info()
            .unwrap();
        let mut out = vec![0; reader.output_buffer_size().unwrap()];
        reader.next_frame(&mut out).unwrap();
        assert_eq!(out, f.rgba);
    }
    #[test]
    fn order_requires_exact_permutation() {
        let b = Bundle {
            items: vec![
                Item {
                    id: "one".into(),
                    name: "A".into(),
                    kind: "text".into(),
                    text: "hello".into(),
                    size: 0,
                },
                Item {
                    id: "two".into(),
                    name: "B".into(),
                    kind: "text".into(),
                    text: "world".into(),
                    size: 0,
                },
            ],
        };
        assert!(reorder(&b, &["one".into(), "one".into()]).is_err());
        assert!(reorder(&b, &["other".into(), "one".into()]).is_err());
        assert_eq!(
            reorder(&b, &["two".into(), "one".into()]).unwrap().items[0].text,
            "world"
        );
    }
    #[test]
    fn persistence_is_separate_and_failure_keeps_memory() {
        let dir = std::env::temp_dir().join(id());
        let store = Materials::new(dir.clone()).unwrap();
        let item = Item {
            id: id(),
            name: "A".into(),
            kind: "text".into(),
            text: "<script> literal".into(),
            size: 0,
        };
        store.append(item.clone(), None).unwrap();
        assert_eq!(
            Materials::new(dir.clone())
                .unwrap()
                .bundle
                .lock()
                .unwrap()
                .items[0]
                .text,
            item.text
        );
        fs::remove_dir_all(&dir).unwrap();
        fs::write(&dir, b"blocked").unwrap();
        assert!(store.append(item, None).is_err());
        assert_eq!(store.bundle.lock().unwrap().items.len(), 1);
        fs::remove_file(dir).unwrap();
    }
}
