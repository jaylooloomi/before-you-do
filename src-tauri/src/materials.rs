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
#[derive(Clone, Serialize, Deserialize)]
struct TaskPack { id: String, name: String, bundle: Bundle }
#[derive(Clone, Serialize, Deserialize)]
struct TaskPacks { version: u8, active: String, packs: Vec<TaskPack> }
impl TaskPacks {
    fn legacy(bundle: Bundle) -> Self { Self {version:1,active:"legacy".into(),packs:vec![TaskPack{id:"legacy".into(),name:"My task".into(),bundle}]} }
    fn validate(self)->Result<Self,String>{
        if self.version!=1 || self.packs.is_empty(){return Err("Invalid task pack store".into());}
        let mut ids=std::collections::HashSet::new();let mut names=std::collections::HashSet::new();let mut assets=std::collections::HashSet::new();
        for pack in &self.packs {if pack.id.is_empty()||!ids.insert(&pack.id)||!names.insert(pack.name.trim().to_lowercase())||pack.name.trim().is_empty(){return Err("Invalid task pack".into());}validate_bundle(pack.bundle.clone())?;for item in &pack.bundle.items{if !assets.insert(&item.id){return Err("Shared material ID".into());}}}
        if !ids.contains(&self.active){return Err("Active task pack missing".into());}Ok(self)
    }
    fn bundle(&self)->Bundle{self.packs.iter().find(|p|p.id==self.active).unwrap().bundle.clone()}
}
pub struct Materials {
    load_error: Option<String>,
    root: PathBuf,
    bundle: Mutex<Bundle>,
    packs: Mutex<TaskPacks>,
    capture: Mutex<Option<Frame>>,
    presentation: Mutex<(u64,u8)>,
    audit_gate: Mutex<(bool,Option<std::sync::mpsc::SyncSender<()>>)>,
    presentation_waiter: Mutex<Option<(u64,std::sync::mpsc::SyncSender<Result<(),String>>)>>,
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
                .and_then(|bytes| {
                    let value:serde_json::Value=serde_json::from_slice(&bytes).map_err(err)?;
                    if value.get("packs").is_some(){serde_json::from_value::<TaskPacks>(value).map_err(err)?.validate()}
                    else {let bundle=validate_bundle(serde_json::from_value(value).map_err(err)?)?;
                        // Keep the original bytes, including unknown legacy fields, before first migration.
                        let backup=root.join("session.legacy.json");
                        if !backup.exists(){use std::io::Write;let mut out=fs::OpenOptions::new().write(true).create_new(true).open(backup).map_err(err)?;out.write_all(&bytes).map_err(err)?;out.sync_all().map_err(err)?;}
                        Ok(TaskPacks::legacy(bundle))}
                })
        } else {
            Ok(TaskPacks::legacy(Bundle::default()))
        };
        let (bundle, load_error) = match loaded {
            Ok(bundle) => (bundle, None),
            Err(e) => (TaskPacks::legacy(Bundle::default()), Some(e)),
        };
        Ok(Self {
            load_error,
            root,
            bundle: Mutex::new(bundle.bundle()),
            packs: Mutex::new(bundle),
            capture: Mutex::new(None),
            presentation: Mutex::new((0,0)),
            audit_gate: Mutex::new((false,None)),
            presentation_waiter: Mutex::new(None),
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
        if let Some((_,tx))=self.presentation_waiter.lock().unwrap_or_else(|e|e.into_inner()).take(){let _=tx.send(Ok(()));}
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
        let mut packs=self.packs.lock().map_err(err)?;let mut next=packs.clone();
        next.packs.iter_mut().find(|p|p.id==next.active).ok_or("Task pack missing")?.bundle=bundle.clone();
        self.write_packs(&next)?;*packs=next;Ok(())
    }
    fn write_packs(&self,packs:&TaskPacks)->Result<(),String>{
        fs::create_dir_all(&self.root).map_err(err)?;
        let tmp = self.root.join("session.json.tmp");
        use std::io::Write;
        let mut file=fs::File::create(&tmp).map_err(err)?;
        file.write_all(&serde_json::to_vec_pretty(packs).map_err(err)?).map_err(err)?;file.sync_all().map_err(err)?;drop(file);
        fs::rename(tmp, self.root.join("session.json")).map_err(err)
    }
    fn select_pack(&self,target:Option<String>,name:Option<String>)->Result<serde_json::Value,String>{
        self.ready()?;
        let _operation=self.operation.lock().map_err(err)?;
        if self.busy.load(std::sync::atomic::Ordering::SeqCst){return Err("Finish capture before switching task packs".into());}
        let mut bundle=self.bundle.lock().map_err(err)?;let mut packs=self.packs.lock().map_err(err)?;let mut next=packs.clone();
        next.packs.iter_mut().find(|p|p.id==next.active).ok_or("Task pack missing")?.bundle=bundle.clone();
        if let Some(name)=name {let name=name.trim();if name.is_empty()||name.chars().count()>80||name.chars().any(char::is_control){return Err("Enter a task name (1–80 characters)".into());}
            if next.packs.iter().any(|p|p.name.to_lowercase()==name.to_lowercase()){return Err("Task name already exists".into());}
            let key=id();next.packs.push(TaskPack{id:key.clone(),name:name.into(),bundle:Bundle::default()});next.active=key;
        }else if let Some(target)=target {if !next.packs.iter().any(|p|p.id==target){return Err("Task pack not found".into());}next.active=target;}
        self.write_packs(&next)?;*bundle=next.bundle();*packs=next;
        Ok(serde_json::to_value(&*packs).map_err(err)?)
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
fn video_mime(bytes:&[u8])->Option<&'static str>{
 if bytes.starts_with(&[0x1a,0x45,0xdf,0xa3])&&bytes[..bytes.len().min(4096)].windows(4).any(|s|s==b"webm"){return Some("video/webm");}
 if bytes.len()>=16&&bytes.get(4..8)==Some(b"ftyp") {let size=u32::from_be_bytes(bytes[..4].try_into().ok()?)as usize;if size>=16&&size<=bytes.len()&&[b"isom",b"iso2",b"mp41",b"mp42",b"avc1",b"M4V ",b"dash"].iter().any(|brand|bytes.get(8..12)==Some(brand.as_slice())){return Some("video/mp4");}}
 None
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
#[tauri::command]
pub fn materials_packs(w:tauri::WebviewWindow,state:tauri::State<Materials>)->Result<serde_json::Value,String>{manager(&w)?;state.ready()?;serde_json::to_value(&*state.packs.lock().map_err(err)?).map_err(err)}
#[tauri::command]
pub fn materials_select_pack(w:tauri::WebviewWindow,app:tauri::AppHandle,state:tauri::State<Materials>,target:Option<String>,name:Option<String>)->Result<serde_json::Value,String>{
    manager(&w)?;if app.state::<crate::recording::Recorder>().active(){return Err("Finish recording before switching task packs".into());}state.select_pack(target,name)
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
pub async fn materials_choose_files(w:tauri::WebviewWindow,app:tauri::AppHandle)->Result<Bundle,String>{
    manager(&w)?;
    #[cfg(windows)] {
        let owner=w.hwnd().map_err(err)?.0 as usize;
        tauri::async_runtime::spawn_blocking(move||{
            use windows_sys::Win32::UI::Controls::Dialogs::*;
            let mut buffer=vec![0u16;65536];let mut dialog:OPENFILENAMEW=unsafe{std::mem::zeroed()};
            dialog.lStructSize=std::mem::size_of::<OPENFILENAMEW>() as u32;dialog.hwndOwner=owner as _;
            dialog.lpstrFile=buffer.as_mut_ptr();dialog.nMaxFile=buffer.len() as u32;
            dialog.Flags=OFN_EXPLORER|OFN_ALLOWMULTISELECT|OFN_FILEMUSTEXIST|OFN_PATHMUSTEXIST|OFN_NOCHANGEDIR;
            let ok=unsafe{GetOpenFileNameW(&mut dialog)};
            let state=app.state::<Materials>();state.ready()?;
            if ok==0{let code=unsafe{CommDlgExtendedError()};return if code==0{Ok(state.bundle.lock().map_err(err)?.clone())}else{Err(format!("File dialog failed: {code}"))};}
            let paths=chosen_paths(&buffer)?;
            for path in paths {
                if fs::metadata(&path).map_err(err)?.len()>MAX_FILE as u64{return Err("Maximum file size is 25 MB".into());}
                let bytes=fs::read(&path).map_err(err)?;if bytes.len()>MAX_FILE{return Err("Maximum file size is 25 MB".into());}
                let name=path.file_name().and_then(|s|s.to_str()).ok_or("Invalid filename")?.to_string();validate_name(&name)?;
                let kind=if image_mime(&bytes).is_some(){"image"}else{"file"};
                state.append(Item{id:id(),name,kind:kind.into(),text:String::new(),size:bytes.len() as u64},Some(&bytes))?;
            }
            let result=state.bundle.lock().map_err(err)?.clone();let _=app.emit_to("main","materials-updated",());Ok(result)
        }).await.map_err(err)?
    }
    #[cfg(not(windows))] {let _=app;Err("Global file shortcuts currently support Windows only".into())}
}
#[cfg(any(windows,test))]
fn chosen_paths(buffer:&[u16])->Result<Vec<PathBuf>,String>{
    let values=buffer.split(|c|*c==0).take_while(|part|!part.is_empty()).map(|part|String::from_utf16(part).map_err(err)).collect::<Result<Vec<_>,_>>()?;
    let Some(first)=values.first() else{return Ok(vec![])};
    if values.len()==1{return Ok(vec![PathBuf::from(first)]);}
    Ok(values[1..].iter().map(|name|PathBuf::from(first).join(name)).collect())
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
pub fn materials_replace_image(w:tauri::WebviewWindow,state:tauri::State<Materials>,item_id:String,bytes:Vec<u8>)->Result<Bundle,String>{
    manager(&w)?;replace_image(&state,&item_id,bytes)
}
fn replace_image(state:&Materials,item_id:&str,bytes:Vec<u8>)->Result<Bundle,String>{
    state.ready()?;
    if bytes.len()>MAX_FILE{return Err("Maximum file size is 25 MB".into());}
    // Decode and encode again: store only a single pixel frame, never editor metadata or source layers.
    let decoder=png::Decoder::new(std::io::Cursor::new(&bytes));
    let mut reader=decoder.read_info().map_err(err)?;
    let info=reader.info();
    if info.width as u64*info.height as u64>32_000_000 || info.animation_control.is_some(){return Err("Unsupported image dimensions or animation".into());}
    let mut pixels=vec![0;reader.output_buffer_size().ok_or("Invalid PNG size")?];
    let frame=reader.next_frame(&mut pixels).map_err(err)?;
    if !matches!(frame.color_type,png::ColorType::Rgb|png::ColorType::Rgba)||frame.bit_depth!=png::BitDepth::Eight{return Err("Expected 8-bit RGB PNG".into());}
    let mut clean=Vec::new();{
        let mut encoder=png::Encoder::new(&mut clean,frame.width,frame.height);encoder.set_color(frame.color_type);encoder.set_depth(frame.bit_depth);
        let mut writer=encoder.write_header().map_err(err)?;writer.write_image_data(&pixels[..frame.buffer_size()]).map_err(err)?;
    }
    if clean.len()>MAX_FILE{return Err("Maximum file size is 25 MB".into());}
    let mut current=state.bundle.lock().map_err(err)?;
    let mut next=current.clone();
    let item=next.items.iter_mut().find(|i|i.id==item_id&&i.kind=="image").ok_or("Image not found")?;
    if current.items.iter().map(|i|i.size).sum::<u64>()-item.size+clean.len() as u64>MAX_TOTAL{return Err("Maximum total size is 100 MB".into());}
    item.size=clean.len() as u64;item.name=format!("{}.png",item.name.rsplit_once('.').map(|(stem,_)|stem).unwrap_or(&item.name));
    if validate_name(&item.name).is_err(){item.name=format!("edited-{item_id}.png");}
    // Remove the app's OS-opening copy before replacing; exports always read the current asset.
    let opened=state.root.join("opened").join(item_id);
    if opened.exists(){fs::remove_dir_all(&opened).map_err(err)?;}
    let temporary=state.root.join("files").join(format!("{item_id}.edited"));
    fs::write(&temporary,&clean).map_err(err)?;
    if let Err(e)=fs::rename(&temporary,state.asset(item_id)){let _=fs::remove_file(&temporary);return Err(err(e));}
    // If session persistence fails, the source pixels are still replaced (fail closed).
    *current=next.clone();state.commit(&next)?;Ok(next)
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
pub fn materials_info(w: tauri::WebviewWindow, state: tauri::State<Materials>, item_id: String) -> Result<serde_json::Value, String> {
    manager(&w)?;
    state.ready()?;
    material_info(&state, &item_id)
}
fn material_info(state: &Materials, item_id: &str) -> Result<serde_json::Value, String> {
    let current=state.bundle.lock().map_err(err)?;
    let item=current.items.iter().find(|i|i.id==item_id && i.kind!="text").ok_or("Material not found")?;
    let metadata=fs::metadata(state.asset(&item.id)).map_err(err)?;
    let created=metadata.created().ok().and_then(|time|time.duration_since(UNIX_EPOCH).ok()).map(|time|time.as_millis() as u64);
    Ok(serde_json::json!({"size":metadata.len(),"created_ms":created}))
}
// Assets use extensionless internal IDs. A named opening copy gives the OS the real file association.
fn prepare_open_file(state:&Materials,item_id:&str)->Result<PathBuf,String>{
    state.ready()?;
    let current=state.bundle.lock().map_err(err)?;
    let item=current.items.iter().find(|i|i.id==item_id&&i.kind!="text").ok_or("Material file not found")?;
    validate_name(&item.name)?;
    let source=fs::canonicalize(state.asset(&item.id)).map_err(err)?;
    let files=fs::canonicalize(state.root.join("files")).map_err(err)?;
    if !source.starts_with(&files)||!source.is_file(){return Err("Invalid material path".into());}
    let folder=state.root.join("opened").join(&item.id);fs::create_dir_all(&folder).map_err(err)?;
    let destination=folder.join(&item.name);
    if destination.exists(){
        let target=fs::canonicalize(&destination).map_err(err)?;
        if !target.starts_with(fs::canonicalize(&folder).map_err(err)?){return Err("Invalid opening path".into());}
    }else{fs::copy(source,&destination).map_err(err)?;}
    // Use a conventional absolute path for shell associations, after checking the canonical path.
    fs::canonicalize(&destination).map_err(err)?;
    Ok(destination)
}
#[tauri::command]
pub async fn materials_open(w:tauri::WebviewWindow,state:tauri::State<'_,Materials>,item_id:String)->Result<(),String>{
    manager(&w)?;let path=prepare_open_file(&state,&item_id)?;
    let result=tauri::async_runtime::spawn_blocking(move||{
        #[cfg(windows)] {
            use std::os::windows::ffi::OsStrExt;
            let filename:Vec<u16>=path.as_os_str().encode_wide().chain(Some(0)).collect();
            let verb:Vec<u16>="open".encode_utf16().chain(Some(0)).collect();
            let result=unsafe{windows_sys::Win32::UI::Shell::ShellExecuteW(std::ptr::null_mut(),verb.as_ptr(),filename.as_ptr(),std::ptr::null(),std::ptr::null(),1)};
            if result as isize<=32{return Err(format!("Cannot open material with default app ({}).",result as isize));}
        }
        #[cfg(not(windows))] {
            let status=std::process::Command::new(if cfg!(target_os="macos"){ "open" }else{ "xdg-open" }).arg(path).status().map_err(err)?;
            if !status.success(){return Err("Cannot open material with default app".into());}
        }
        Ok(())
    }).await.map_err(err)?;
    if result.is_ok(){let _=w.set_always_on_top(false);}
    result
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
        .find(|i| i.id == item_id && i.kind != "text")
        .ok_or("Media not found")?;
    let bytes = fs::read(state.asset(&item.id)).map_err(err)?;
    Ok(format!(
        "data:{};base64,{}",
        image_mime(&bytes).or_else(||video_mime(&bytes)).ok_or("Unsupported media")?,
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
        prompt.push_str(&format!("[Material #{:02}]\n", n + 1));
        if item.kind == "text" {
            prompt.push_str(&format!("{}\n\n", item.text));
        } else {
            let name = format!("{:02}-{}", n + 1, item.name);
            fs::copy(state.asset(&item.id), dir.join(&name)).map_err(err)?;
            prompt.push_str(&format!("[Attachment: {}]\n\n", name));
        }
    }
    fs::write(dir.join("prompt.md"), prompt).map_err(err)?;
    let mut manifest=serde_json::to_value(&*current).map_err(err)?;
    {let packs=state.packs.lock().map_err(err)?;let pack=packs.packs.iter().find(|p|p.id==packs.active).ok_or("Task pack missing")?;manifest["task_pack"]=serde_json::json!({"id":pack.id,"name":pack.name});}
    for (n,item) in manifest["items"].as_array_mut().ok_or("Invalid manifest")?.iter_mut().enumerate(){
        item["number"]=serde_json::json!(format!("{:02}",n+1));
        if item["kind"]!="text" {item["export_name"]=serde_json::json!(format!("{:02}-{}",n+1,current.items[n].name));}
    }
    fs::write(
        dir.join("manifest.json"),
        serde_json::to_vec_pretty(&manifest).map_err(err)?,
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
    pointer: [f64; 2],
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
        pointer: crate::capture_presentation::pointer(f),
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
async fn presentation_step(app:tauri::AppHandle,session:u64,present:bool)->Result<(),String>{
 let(tx,rx)=std::sync::mpsc::sync_channel(1);let handle=app.clone();app.run_on_main_thread(move||{let result=(||{
  let state=handle.state::<Materials>();let _operation=state.operation.lock().map_err(err)?;
  native::check_session(state.generation.load(std::sync::atomic::Ordering::SeqCst),Some(session),true).map_err(|e|e.to_string())?;
  if !state.busy.load(std::sync::atomic::Ordering::SeqCst)||state.capture.lock().map_err(err)?.is_none(){return Err(native::CaptureError::StaleSession.to_string());}
  let overlay=handle.get_webview_window("capture").ok_or("Capture window unavailable")?;let mut stage=state.presentation.lock().map_err(err)?;
  if stage.0!=session{return Err(native::CaptureError::StaleSession.to_string());}
  if stage.1==2{return Ok(());}
  if present {
   if stage.1!=1{return Err("Capture has not been primed".into());}
   crate::capture_presentation::present(&overlay)?;stage.1=2;
   if let Some((_,reply))=state.presentation_waiter.lock().map_err(err)?.take(){let _=reply.send(Ok(()));}
  }else{crate::capture_presentation::prime(&overlay)?;stage.1=1;}
  Ok(())
 })();let _=tx.send(result);}).map_err(err)?;
 tauri::async_runtime::spawn_blocking(move||rx.recv().map_err(err)).await.map_err(err)?.and_then(|r|r)
}
#[tauri::command]
pub async fn capture_prime(app:tauri::AppHandle,w:tauri::WebviewWindow,session:u64)->Result<(),String>{if w.label()!="capture"{return Err("Capture window only".into());}presentation_step(app,session,false).await}
#[tauri::command]
pub async fn capture_present(app:tauri::AppHandle,w:tauri::WebviewWindow,session:u64)->Result<(),String>{
 if w.label()!="capture"{return Err("Capture window only".into());}
 let rx={let state=app.state::<Materials>();let mut gate=state.audit_gate.lock().map_err(err)?;if gate.0{let(tx,rx)=std::sync::mpsc::sync_channel(1);gate.1=Some(tx);Some(rx)}else{None}};
 if let Some(rx)=rx{tauri::async_runtime::spawn_blocking(move||rx.recv_timeout(std::time::Duration::from_secs(15)).map_err(err)).await.map_err(err)??;}
 presentation_step(app,session,true).await
}
#[tauri::command]
pub fn capture_prepare_failed(w:tauri::WebviewWindow,state:tauri::State<Materials>,session:u64)->Result<(),String>{
 if w.label()!="capture"{return Err("Capture window only".into());}let _operation=state.operation.lock().map_err(err)?;
 native::check_session(state.generation.load(std::sync::atomic::Ordering::SeqCst),Some(session),true).map_err(|e|e.to_string())?;
 if let Some((_,reply))=state.presentation_waiter.lock().map_err(err)?.take(){let _=reply.send(Err("Capture image could not be prepared".into()));}Ok(())
}
#[tauri::command]
pub fn preview_capture_gate(w:tauri::WebviewWindow,app:tauri::AppHandle,hold:bool)->Result<(),String>{
 if w.label()!="main"||!app.state::<crate::State>().preview||!std::env::args().any(|a|a=="--capture-presentation-test"){return Err("Capture presentation audit mode required".into());}
 let state=app.state::<Materials>();let mut gate=state.audit_gate.lock().map_err(err)?;gate.0=hold;if !hold{if let Some(tx)=gate.1.take(){let _=tx.send(());}}Ok(())
}
#[tauri::command]
pub async fn preview_capture_start(w:tauri::WebviewWindow,app:tauri::AppHandle)->Result<(),String>{
 if w.label()!="main"||!app.state::<crate::State>().preview||!std::env::args().any(|a|a=="--capture-presentation-test"){return Err("Capture presentation audit mode required".into());}
 start_internal(app,"region".into(),false).await
}
#[tauri::command]
pub fn preview_capture_presentation(w:tauri::WebviewWindow,app:tauri::AppHandle)->Result<serde_json::Value,String>{
 if w.label()!="main"||!app.state::<crate::State>().preview||!std::env::args().any(|a|a=="--capture-presentation-test"){return Err("Capture presentation audit mode required".into());}
 let state=app.state::<Materials>();let stage=*state.presentation.lock().map_err(err)?;let overlay=app.get_webview_window("capture").ok_or("Missing capture window")?;
 #[cfg(windows)]unsafe{use windows_sys::Win32::UI::WindowsAndMessaging::*;let hwnd=overlay.hwnd().map_err(err)?.0 as _;let(mut key,mut alpha,mut flags)=(0,0u8,0);let has_alpha=GetLayeredWindowAttributes(hwnd,&mut key,&mut alpha,&mut flags)!=0;return Ok(serde_json::json!({"session":stage.0,"stage":stage.1,"visible":overlay.is_visible().map_err(err)?,"alpha":if has_alpha{Some(alpha)}else{None},"busy":state.busy.load(std::sync::atomic::Ordering::SeqCst),"exStyle":GetWindowLongPtrW(hwnd,GWL_EXSTYLE),"foreground":GetForegroundWindow()as usize}));}
 #[cfg(not(windows))]Ok(serde_json::json!({"session":stage.0,"stage":stage.1,"visible":overlay.is_visible().map_err(err)?}))
}
pub fn cancel(app: &tauri::AppHandle) {
    app.state::<Materials>().invalidate_capture();
    if let Some(window) = app.get_webview_window("capture") {
        let _ = crate::capture_presentation::hide(&window);
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
    if let Some((_,tx))=state.presentation_waiter.lock().map_err(err)?.take(){let _=tx.send(Ok(()));}
    state.busy.store(false, std::sync::atomic::Ordering::SeqCst);
    drop(operation);
    let _ = crate::capture_presentation::hide(&w);
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
            let _ = crate::capture_presentation::hide(&overlay);
        }
        if from_manager{crate::manage(&app);}
    }
    result
}
async fn show_region(app: tauri::AppHandle, frame: Frame, generation: u64) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    let (present_tx,present_rx)=std::sync::mpsc::sync_channel(1);
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
            crate::capture_presentation::hide(&overlay)?;
            *state.capture.lock().map_err(err)? = Some(frame);
            *state.presentation.lock().map_err(err)?=(generation,0);
            *state.presentation_waiter.lock().map_err(err)?=Some((generation,present_tx));
            handle
                .emit_to("capture", "capture-ready", generation)
                .map_err(err)?;
            // Only capture_prime may show at alpha zero; capture_present reveals a painted frame.
            Ok(())
        })();
        let _ = tx.send(result);
    })
    .map_err(err)?;
    tauri::async_runtime::spawn_blocking(move || rx.recv().map_err(err)).await.map_err(err)?.and_then(|result|result)?;
    tauri::async_runtime::spawn_blocking(move || present_rx.recv_timeout(std::time::Duration::from_secs(20)).map_err(|_|"Capture presentation timed out".to_string())).await.map_err(err)?.and_then(|result|result)

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
    #[test]
    fn task_packs_migrate_switch_restart_and_export_without_mixing(){
        let root=std::env::temp_dir().join(id());fs::create_dir_all(root.join("files")).unwrap();
        let legacy=br#"{"items":[{"id":"abc","name":"note.txt","kind":"file","text":"","size":3},{"id":"def","name":"Text","kind":"text","text":"Client A draft","size":0}],"unknown":"preserve"}"#;
        fs::write(root.join("session.json"),legacy).unwrap();fs::write(root.join("files/abc"),b"AAA").unwrap();
        let store=Materials::new(root.clone()).unwrap();assert!(store.ready().is_ok());assert_eq!(fs::read(root.join("session.legacy.json")).unwrap(),legacy);
        assert_eq!(fs::read(root.join("session.json")).unwrap(),legacy);
        store.busy.store(true,std::sync::atomic::Ordering::SeqCst);assert!(store.select_pack(None,Some("Busy".into())).is_err());store.busy.store(false,std::sync::atomic::Ordering::SeqCst);
        store.select_pack(None,Some("Client B".into())).unwrap();assert!(store.bundle.lock().unwrap().items.is_empty());
        store.append(Item{id:"123".into(),name:"Text".into(),kind:"text".into(),text:"Client B draft".into(),size:0},None).unwrap();
        store.append(Item{id:"456".into(),name:"note.txt".into(),kind:"file".into(),text:String::new(),size:3},Some(b"BBB")).unwrap();
        {let mut current=store.bundle.lock().unwrap();let next=reorder(&current,&["456".into(),"123".into()]).unwrap();store.commit(&next).unwrap();*current=next;}
        let exported=PathBuf::from(export_bundle(&store).unwrap());let prompt=fs::read_to_string(exported.join("prompt.md")).unwrap();assert!(prompt.contains("Client B draft"));assert!(!prompt.contains("Client A"));
        assert_eq!(fs::read(exported.join("01-note.txt")).unwrap(),b"BBB");
        let restarted=Materials::new(root.clone()).unwrap();assert_eq!(restarted.bundle.lock().unwrap().items[1].text,"Client B draft");assert_eq!(restarted.bundle.lock().unwrap().items[0].id,"456");
        assert!(restarted.select_pack(None,Some(" client b ".into())).is_err());assert!(restarted.select_pack(None,Some("  ".into())).is_err());assert!(restarted.select_pack(Some("missing".into()),None).is_err());
        restarted.select_pack(Some("legacy".into()),None).unwrap();let current=restarted.bundle.lock().unwrap().clone();assert_eq!(current.items[0].id,"abc");assert_eq!(current.items[1].text,"Client A draft");
        let exported=PathBuf::from(export_bundle(&restarted).unwrap());assert_eq!(fs::read(exported.join("01-note.txt")).unwrap(),b"AAA");
        let original=fs::read(root.join("session.json")).unwrap();fs::write(root.join("session.json.tmp"),b"interrupted write").unwrap();
        let recovered=Materials::new(root.clone()).unwrap();assert_eq!(recovered.bundle.lock().unwrap().items.len(),2);assert_eq!(fs::read(root.join("session.json")).unwrap(),original);assert_eq!(fs::read(root.join("session.legacy.json")).unwrap(),legacy);
        // A failed replacement leaves memory and committed selection unchanged.
        fs::remove_file(root.join("session.json.tmp")).unwrap();fs::create_dir(root.join("session.json.tmp")).unwrap();assert!(recovered.select_pack(None,Some("Blocked".into())).is_err());assert_eq!(recovered.packs.lock().unwrap().active,"legacy");assert_eq!(fs::read(root.join("session.json")).unwrap(),original);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn opening_files_keeps_extensions_and_does_not_modify_sources(){
        let dir=std::env::temp_dir().join(id());let store=Materials::new(dir.clone()).unwrap();
        store.append(Item{id:"photo".into(),name:"圖片.png".into(),kind:"image".into(),text:String::new(),size:3},Some(b"png")).unwrap();
        let session=fs::read(dir.join("session.json")).unwrap();
        let opened=prepare_open_file(&store,"photo").unwrap();assert_eq!(opened.file_name().unwrap(),"圖片.png");assert_eq!(fs::read(&opened).unwrap(),b"png");
        fs::write(&opened,b"external edit").unwrap();assert_eq!(prepare_open_file(&store,"photo").unwrap(),opened);assert_eq!(fs::read(&opened).unwrap(),b"external edit");
        assert_eq!(fs::read(store.asset("photo")).unwrap(),b"png");assert_eq!(fs::read(dir.join("session.json")).unwrap(),session);
        assert!(prepare_open_file(&store,"../../missing").is_err());
        store.append(Item{id:"text".into(),name:"Text".into(),kind:"text".into(),text:"draft".into(),size:0},None).unwrap();assert!(prepare_open_file(&store,"text").is_err());
        fs::remove_file(store.asset("photo")).unwrap();assert!(prepare_open_file(&store,"photo").is_err());fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn selected_file_paths_support_cancel_single_and_multiple_unicode_names(){
        let encode=|s:&str|s.encode_utf16().collect::<Vec<_>>();
        assert!(chosen_paths(&[0,0]).unwrap().is_empty());
        assert_eq!(chosen_paths(&encode("C:\\files\\單張.png\0\0")).unwrap(),vec![PathBuf::from("C:\\files\\單張.png")]);
        assert_eq!(chosen_paths(&encode("C:\\files\0a.png\0b.txt\0\0")).unwrap(),vec![PathBuf::from("C:\\files").join("a.png"),PathBuf::from("C:\\files").join("b.txt")]);
    }

    #[test]
    fn numbered_exports_follow_order_and_keep_original_materials() {
        let dir=std::env::temp_dir().join(id());
        let store=Materials::new(dir.clone()).unwrap();
        for (key,kind,name,text,bytes) in [("text","text","Task","literal <script>",None),("image","image","same.png","",Some(&b"image"[..])),("file","file","same.png","",Some(&b"file"[..]))] {
            store.append(Item{id:key.into(),kind:kind.into(),name:name.into(),text:text.into(),size:bytes.map_or(0,|b|b.len() as u64)},bytes).unwrap();
        }
        for ids in [["text","image","file"],["file","text","image"]] {
            let next=reorder(&store.bundle.lock().unwrap(),&ids.map(String::from)).unwrap();
            store.commit(&next).unwrap();
            *store.bundle.lock().unwrap()=next;
            let before=serde_json::to_value(&*store.bundle.lock().unwrap()).unwrap();
            let exported=PathBuf::from(export_bundle(&store).unwrap());
            let manifest:serde_json::Value=serde_json::from_slice(&fs::read(exported.join("manifest.json")).unwrap()).unwrap();
            let mut expected=String::new();
            for (n,key) in ids.iter().enumerate(){
                let number=format!("{:02}",n+1);expected.push_str(&format!("[Material #{}]\n",number));
                assert_eq!(manifest["items"][n]["id"],*key);assert_eq!(manifest["items"][n]["number"],number);
                if *key=="text" {expected.push_str("literal <script>\n\n");}else{
                    let filename=format!("{}-same.png",number);expected.push_str(&format!("[Attachment: {}]\n\n",filename));
                    assert_eq!(manifest["items"][n]["export_name"],filename);
                    assert_eq!(fs::read(exported.join(filename)).unwrap(),if *key=="image"{b"image".to_vec()}else{b"file".to_vec()});
                }
            }
            assert_eq!(fs::read_to_string(exported.join("prompt.md")).unwrap(),expected);
            assert_eq!(serde_json::to_value(&*store.bundle.lock().unwrap()).unwrap(),before);
        }
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn material_details_read_real_files_and_never_mutate_bundle() {
        let root=std::env::temp_dir().join(format!("material-info-{}",id()));
        let store=Materials::new(root.clone()).unwrap();
        let key=id();
        store.append(Item{id:key.clone(),name:"sample.webm".into(),kind:"file".into(),text:String::new(),size:7},Some(b"example")).unwrap();
        let original=fs::read(root.join("session.json")).unwrap();
        let info=material_info(&store,&key).unwrap();
        assert_eq!(info["size"].as_u64(),Some(7));
        if let Some(created)=info["created_ms"].as_u64(){assert!(created>0);assert!(created<=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64);}
        assert!(material_info(&store,"../../outside").is_err());
        assert!(material_info(&store,"unknown").is_err());
        assert_eq!(fs::read(root.join("session.json")).unwrap(),original);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn video_preview_requires_a_recognized_container(){
        assert_eq!(super::video_mime(b"\x1a\x45\xdf\xa3webm"),Some("video/webm"));
        assert_eq!(super::video_mime(b"\x00\x00\x00\x10ftypisom0000"),Some("video/mp4"));
        assert_eq!(super::video_mime(b"<script>webm</script>"),None);
        assert_eq!(super::video_mime(b"\x1a\x45\xdf\xa3matroska"),None);
        assert_eq!(super::video_mime(b"\xff\xff\xff\xffftypisom0000"),None);
    }

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
#[cfg(test)]
mod image_edit_tests {
 use super::*;
 fn png_pixel(pixel:[u8;4])->Vec<u8>{let mut bytes=Vec::new();{let mut encoder=png::Encoder::new(&mut bytes,1,1);encoder.set_color(png::ColorType::Rgba);encoder.set_depth(png::BitDepth::Eight);let mut w=encoder.write_header().unwrap();w.write_image_data(&pixel).unwrap();}bytes}
 #[test]
 fn replaced_pixels_are_the_only_new_export_and_open_source(){
  let root=std::env::temp_dir().join(id());let state=Materials::new(root.clone()).unwrap();let original=png_pixel([255,0,0,255]);let bundle=add_png(&state,original.clone()).unwrap();let key=&bundle.items[0].id;
  let opened=prepare_open_file(&state,key).unwrap();assert_eq!(fs::read(&opened).unwrap(),original);
  let clean=png_pixel([0,0,0,255]);replace_image(&state,key,clean.clone()).unwrap();assert!(!opened.exists());
  let reopened=prepare_open_file(&state,key).unwrap();assert_eq!(fs::read(reopened).unwrap(),clean);
  let export=PathBuf::from(export_bundle(&state).unwrap());let files=fs::read_dir(&export).unwrap().map(|e|e.unwrap().path()).collect::<Vec<_>>();assert_eq!(files.len(),3);
  let image=files.iter().find(|p|p.extension().is_some_and(|e|e=="png")).unwrap();assert_eq!(fs::read(image).unwrap(),clean);assert_eq!(fs::read(state.asset(key)).unwrap(),clean);
  let reloaded=Materials::new(root.clone()).unwrap();assert_eq!(reloaded.bundle.lock().unwrap().items.len(),1);assert!(replace_image(&state,key,b"not PNG".to_vec()).is_err());assert_eq!(fs::read(state.asset(key)).unwrap(),clean);
  fs::remove_dir_all(root).unwrap();
 }
}
