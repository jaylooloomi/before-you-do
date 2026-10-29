use crate::capture::{self as native, Frame};
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
    intent: Mutex<String>,
    restore_main: std::sync::atomic::AtomicBool,
    generation: std::sync::atomic::AtomicU64,
    operation: Mutex<()>,
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
            intent: Mutex::new(String::from("region")),
            restore_main: std::sync::atomic::AtomicBool::new(true),
            generation: std::sync::atomic::AtomicU64::new(0),
            operation: Mutex::new(()),
            busy: std::sync::atomic::AtomicBool::new(false),
        })
    }
    pub fn recording_directory(&self)->Result<PathBuf,String>{let dir=self.root.join("recordings-pending");fs::create_dir_all(&dir).map_err(err)?;Ok(dir)}
    pub fn add_recording(&self,name:String,bytes:Vec<u8>,gif:bool)->Result<(),String>{self.ready()?;if bytes.len()>MAX_FILE{return Err("Recording exceeds 25 MB".into());}self.append(Item{id:id(),name,kind:if gif{"image"}else{"file"}.into(),text:String::new(),size:bytes.len() as u64},Some(&bytes))?;Ok(())}
    fn invalidate_capture(&self) {
        let _operation = self.operation.lock().unwrap_or_else(|e| e.into_inner());
        self.generation
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        if let Ok(mut capture) = self.capture.lock() {
            capture.take();
        }
        self.busy.store(false, std::sync::atomic::Ordering::SeqCst);
    }
    fn commit_capture(&self, generation: u64, bytes: Vec<u8>) -> Result<Bundle, String> {
        let _operation = self.operation.lock().map_err(err)?;
        if !native::is_current(
            generation,
            self.generation.load(std::sync::atomic::Ordering::SeqCst),
            self.busy.load(std::sync::atomic::Ordering::SeqCst),
        ) {
            return Err(native::CaptureError::StaleSession.to_string());
        }
        add_png(self, bytes)
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
fn add_frame(state: &Materials, frame: Frame) -> Result<Bundle, String> {
    add_png(state, frame.png()?)
}
fn add_png(state: &Materials, bytes: Vec<u8>) -> Result<Bundle, String> {
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
#[tauri::command]
pub fn capture_capabilities(w: tauri::WebviewWindow) -> Result<native::Capabilities, String> {
    manager(&w)?;
    Ok(native::capabilities())
}
#[tauri::command]
pub async fn capture_request_permission(
    w: tauri::WebviewWindow,
) -> Result<native::Capabilities, String> {
    manager(&w)?;
    tauri::async_runtime::spawn_blocking(native::request_permission)
        .await
        .map_err(err)?
}
#[tauri::command]
pub fn capture_open_permissions(w: tauri::WebviewWindow) -> Result<(), String> {
    manager(&w)?;
    native::open_permissions()
}
#[derive(Serialize)]
pub struct CaptureView {
    origin: [i32; 2],
    candidates: Vec<native::Candidate>,
    session: u64,
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
        origin: [f.x, f.y],
        candidates: f.candidates.clone(),
        session: state.generation.load(std::sync::atomic::Ordering::SeqCst),
        image: format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(f.png()?)
        ),
        width: f.width,
        height: f.height,
    })
}
pub fn cancel(app: &tauri::AppHandle) {
    app.state::<Materials>().invalidate_capture();
    if let Some(window) = app.get_webview_window("capture") {
        let _ = window.hide();
    }
    if app.state::<Materials>().restore_main.load(std::sync::atomic::Ordering::SeqCst){crate::manage(app);}
}
#[tauri::command]
pub fn capture_finish(
    app: tauri::AppHandle,
    w: tauri::WebviewWindow,
    state: tauri::State<Materials>,
    rect: Option<[u32; 4]>,
    session: Option<u64>,
) -> Result<(), String> {
    if w.label() != "capture" {
        return Err("Capture window only".into());
    }
    let operation = state.operation.lock().map_err(err)?;
    native::check_session(
        state.generation.load(std::sync::atomic::Ordering::SeqCst),
        session,
        rect.is_some(),
    )
    .map_err(|e| e.to_string())?;
    let intent=state.intent.lock().map_err(err)?.clone();
    let mut recording=None;
    if let Some([x,y,width,height])=rect {
        let source=state.capture.lock().map_err(err)?;
        let source=source.as_ref().ok_or("No capture")?;
        if intent.starts_with("record-") {
            source.crop(x,y,width,height)?;
            let bounds=[source.x.checked_add(x as i32).ok_or("Coordinate overflow")?,source.y.checked_add(y as i32).ok_or("Coordinate overflow")?,width as i32,height as i32];
            crate::recording::validate_rect(bounds)?;
            recording=Some((if intent=="record-gif"{crate::recording::Format::Gif}else{crate::recording::Format::Video},bounds));
        }else{add_frame(&state,source.crop(x,y,width,height)?)?;}
    }
    state.capture.lock().map_err(err)?.take();
    state.busy.store(false, std::sync::atomic::Ordering::SeqCst);
    drop(operation);
    let _ = w.hide();
    if let Some((format,bounds))=recording {crate::recording::start(app.clone(),format,bounds)?;}
    else if state.restore_main.load(std::sync::atomic::Ordering::SeqCst){crate::manage(&app);}
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
    start_internal(app,mode,true).await
}
pub async fn start_internal(app:tauri::AppHandle, intent:String, from_manager:bool)->Result<(),String>{
    let recording=intent=="record-video"||intent=="record-gif";
    if app.state::<crate::recording::Recorder>().active(){return Err("Recording already in progress".into());}
    if recording && (!cfg!(windows)||!crate::recording::runtime_path().is_some_and(|p|p.is_file())){return Err("Install the recording component from Prompt workspace first (Windows only)".into());}
    let mode=if recording {"region".to_string()}else{intent.clone()};
    mode.parse::<native::CaptureMode>()
        .map_err(|e| e.to_string())?;
    let caps = native::capabilities();
    if !caps.can_capture() {
        return Err(caps
            .reason
            .unwrap_or(native::CaptureError::PermissionRequired.to_string()));
    }
    let state = app.state::<Materials>();
    state.ready()?;
    if state.busy.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return Err("Capture already in progress".into());
    }
    let generation = state
        .generation
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        + 1;
    *state.intent.lock().map_err(err)?=intent;
    let w=app.get_webview_window("main").ok_or("Manager unavailable")?;
    state.restore_main.store(from_manager,std::sync::atomic::Ordering::SeqCst);
    let region = mode == "region";
    let result = async {
        let target = if mode == "window" {
            native::target()?
        } else {
            0
        };
        w.hide().map_err(err)?;
        let frame = tauri::async_runtime::spawn_blocking(move || native::capture(&mode, target))
            .await
            .map_err(err)??;
        if !native::is_current(
            generation,
            state.generation.load(std::sync::atomic::Ordering::SeqCst),
            state.busy.load(std::sync::atomic::Ordering::SeqCst),
        ) {
            return Err(native::CaptureError::StaleSession.to_string());
        }
        if region {
            show_region(app.clone(), frame, generation).await?;
        } else {
            state.commit_capture(generation, frame.png()?)?;
            app.emit_to("main", "materials-updated", ()).map_err(err)?;
        }
        Ok::<(), String>(())
    }
    .await;
    let restore = {
        let operation = state.operation.lock().map_err(err)?;
        let restore = (!region || result.is_err())
            && state.generation.load(std::sync::atomic::Ordering::SeqCst) == generation;
        if restore {
            state.capture.lock().map_err(err)?.take();
            state.busy.store(false, std::sync::atomic::Ordering::SeqCst);
        }
        drop(operation);
        restore
    };
    if restore {
        if let Some(overlay) = app.get_webview_window("capture") {
            let _ = overlay.hide();
        }
        if from_manager{crate::manage(&app);}
    }
    result
}
async fn show_region(app: tauri::AppHandle, frame: Frame, generation: u64) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let result = (|| {
            let state = handle.state::<Materials>();
            let _operation = state.operation.lock().map_err(err)?;
            if !native::is_current(
                generation,
                state.generation.load(std::sync::atomic::Ordering::SeqCst),
                state.busy.load(std::sync::atomic::Ordering::SeqCst),
            ) {
                return Err(native::CaptureError::StaleSession.to_string());
            }
            let overlay = handle
                .get_webview_window("capture")
                .ok_or("Capture window unavailable")?;
            if let Some(bounds) = frame.logical_bounds {
                overlay
                    .set_position(tauri::LogicalPosition::new(bounds.x, bounds.y))
                    .map_err(err)?;
                overlay
                    .set_size(tauri::LogicalSize::new(bounds.width, bounds.height))
                    .map_err(err)?;
            } else {
                overlay
                    .set_position(tauri::PhysicalPosition::new(frame.x, frame.y))
                    .map_err(err)?;
                overlay
                    .set_size(tauri::PhysicalSize::new(frame.width, frame.height))
                    .map_err(err)?;
            }
            *state.capture.lock().map_err(err)? = Some(frame);
            handle
                .emit_to("capture", "capture-ready", ())
                .map_err(err)?;
            overlay.show().map_err(err)?;
            overlay.set_focus().map_err(err)?;
            Ok(())
        })();
        let _ = tx.send(result);
    })
    .map_err(err)?;
    // Await the actual UI-thread completion, not a guessed render delay.
    tauri::async_runtime::spawn_blocking(move || rx.recv().map_err(err))
        .await
        .map_err(err)?
        .and_then(|result| result)
}
/// Explicit command-line audit: no app startup, UI input, clipboard or user settings writes.
pub fn audit(directory: &std::path::Path) -> Result<(), String> {
    fs::create_dir_all(directory).map_err(err)?;
    let frame = native::capture("region", 0)?;
    let roots = frame
        .candidates
        .iter()
        .filter(|candidate| candidate.parent == 0)
        .count();
    if frame.candidates.len() > 4096
        || frame.candidates.iter().any(|candidate| {
            !candidate.valid_in(frame.width, frame.height)
                || candidate.parent != 0
                    && !frame.candidates.iter().any(|parent| {
                        parent.id == candidate.parent && parent.group == candidate.group
                    })
        })
    {
        return Err("Invalid candidate metadata".into());
    }
    fs::write(
        directory.join("candidates.json"),
        serde_json::to_vec_pretty(&frame.candidates).map_err(err)?,
    )
    .map_err(err)?;
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
    if native::capture("invalid", 0).is_ok() {
        return Err("Invalid mode was accepted".into());
    }
    if cfg!(windows) && native::capture("window", 0).is_ok() {
        return Err("Missing target was accepted".into());
    }
    let report = serde_json::json!({"fullscreen":[frame.x,frame.y,frame.width as i32,frame.height as i32],"window":[window.x,window.y,window.width as i32,window.height as i32],"region":[frame.width.min(160),frame.height.min(120)],"pngSignatureValid":png.starts_with(b"\x89PNG\r\n\x1a\n"),"persistedMaterials":2,"exportVerified":true,"systemInput":false,"invalidModeRejected":true,"missingWindowRejected":cfg!(windows),"candidates":frame.candidates.len(),"rootWindows":roots,"candidateBoundsValid":true});
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
    fn canceled_worker_cannot_append_or_reset_a_new_capture() {
        let root = std::env::temp_dir().join(id());
        let state = std::sync::Arc::new(Materials::new(root).unwrap());
        state
            .generation
            .store(1, std::sync::atomic::Ordering::SeqCst);
        state.busy.store(true, std::sync::atomic::Ordering::SeqCst);
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (resume_tx, resume_rx) = std::sync::mpsc::channel();
        let worker = state.clone();
        let handle = std::thread::spawn(move || {
            let png = Frame::new(0, 0, 1, 1, vec![1, 2, 3, 255])
                .unwrap()
                .png()
                .unwrap();
            ready_tx.send(()).unwrap();
            resume_rx.recv().unwrap();
            worker.commit_capture(1, png)
        });
        ready_rx.recv().unwrap();
        state.invalidate_capture();
        let generation = state
            .generation
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
            + 1;
        state.busy.store(true, std::sync::atomic::Ordering::SeqCst);
        resume_tx.send(()).unwrap();
        assert_eq!(
            handle.join().unwrap().err().as_deref(),
            Some("error.capture_session")
        );
        assert!(state.bundle.lock().unwrap().items.is_empty());
        assert!(state.busy.load(std::sync::atomic::Ordering::SeqCst));
        assert_eq!(
            state.generation.load(std::sync::atomic::Ordering::SeqCst),
            generation
        );
        assert!(!state.root.exists());
    }
    #[test]
    fn crop_pixels_and_reject_overflow() {
        let f = Frame {
            x: -4,
            y: 10,
            width: 2,
            height: 2,
            rgba: (0..16).collect(),
            logical_bounds: None,
            candidates: Vec::new(),
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
            logical_bounds: None,
            candidates: Vec::new(),
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
