use std::io::Write;
use std::sync::atomic::{AtomicBool,AtomicU64,AtomicUsize,Ordering};
use tauri::{Emitter,Manager};
pub fn trace(app:&tauri::AppHandle,stage:&str){#[cfg(windows)] crate::quick_audit::observe(stage);if let Ok(root)=app.path().app_config_dir(){let path=root.join("materials-quick-debug.log");if fs_size(&path)>262144{let _=std::fs::write(&path,b"");}if let Ok(mut f)=std::fs::OpenOptions::new().create(true).append(true).open(path){let _=writeln!(f,"{:?} {}",std::time::SystemTime::now(),stage.chars().take(600).collect::<String>());}}}
fn fs_size(p:&std::path::Path)->u64{std::fs::metadata(p).map(|m|m.len()).unwrap_or(0)}
#[tauri::command]pub fn materials_quick_trace(w:tauri::WebviewWindow,app:tauri::AppHandle,stage:String)->Result<(),String>{allowed(&w)?;trace(&app,&format!("{} {}",w.label(),stage));Ok(())}
#[derive(Default)]
pub struct QuickMaterials{generation:AtomicU64,pending:AtomicBool,target:AtomicUsize,hold:AtomicBool,clear_pending:AtomicBool}
impl QuickMaterials {
 fn cancel(&self){self.clear_pending.store(false,Ordering::SeqCst);self.generation.fetch_add(1,Ordering::SeqCst);self.pending.store(false,Ordering::SeqCst);self.hold.store(false,Ordering::SeqCst);}
 fn consume(&self,ticket:u64)->bool{self.generation.load(Ordering::SeqCst)==ticket&&self.pending.swap(false,Ordering::SeqCst)}
}
fn reader_label(label:&str)->bool{matches!(label,"main"|"materials-quick")}
fn allowed(w:&tauri::WebviewWindow)->Result<(),String>{if reader_label(w.label()){Ok(())}else{Err("Quick materials window only".into())}}
pub fn visible(app:&tauri::AppHandle)->bool{app.get_webview_window("materials-quick").is_some_and(|w|w.is_visible().unwrap_or(false))}
pub fn close(app:&tauri::AppHandle)->Result<(),String>{
 #[cfg(windows)] crate::platform::cancel_quick_watch();
 let state=app.state::<QuickMaterials>();state.cancel();
 let focused=app.get_webview_window("materials-quick").is_some_and(|w|w.is_focused().unwrap_or(false));
 if let Some(w)=app.get_webview_window("materials-quick"){w.hide().map_err(|e|e.to_string())?;let _=w.emit("materials-quick-hidden",());}
 let target=state.target.load(Ordering::SeqCst);if target!=0&&focused{let _=crate::platform::focus_target(target);}Ok(())
}
pub fn request_toggle(app:&tauri::AppHandle,hold:bool)->Result<(),String>{
 trace(app,&format!("request-toggle hold={hold}"));
 let state=app.state::<QuickMaterials>();
 // A shortcut invoked in the manager dismisses it, just like Alt+H.
 if hold && app.get_webview_window("main").is_some_and(|w|w.is_visible().unwrap_or(false)&&w.is_focused().unwrap_or(false)){
  close(app)?;return crate::dismiss_manager_shortcut(app.clone());
 }
 if visible(app)||state.pending.load(Ordering::SeqCst){return close(app);}
 if app.state::<crate::materials::Materials>().busy.load(Ordering::SeqCst)||app.state::<crate::recording::Recorder>().active(){return Err("Finish capture or recording first".into());}
 crate::platform::cancel_selection();app.state::<crate::State>().picker.lock().map_err(|e|e.to_string())?.finish(false);if let Some(picker)=app.get_webview_window("picker"){let _=picker.hide();}
 state.clear_pending.store(false,Ordering::SeqCst);state.hold.store(hold,Ordering::SeqCst);
 state.target.store(crate::platform::foreground_target().unwrap_or(0),Ordering::SeqCst);
 let ticket=state.generation.fetch_add(1,Ordering::SeqCst)+1;state.pending.store(true,Ordering::SeqCst);
 app.emit_to("main","materials-quick-request",ticket).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn materials_quick_open(w:tauri::WebviewWindow,app:tauri::AppHandle,ticket:u64)->Result<(),String>{
 if w.label()!="main"{return Err("Manager only".into());}
 let state=app.state::<QuickMaterials>();if !state.consume(ticket){return Ok(());}
 let window=app.get_webview_window("materials-quick").ok_or("Quick materials unavailable")?;
 crate::picker_position::position_sized(&app,&window,state.target.load(Ordering::SeqCst),(640.0,650.0)).map_err(|e|e.to_string())?;
 let config=crate::capture_hotkeys::snapshot(&app).config;let mask=crate::capture_hotkeys::parse(&config.quick)?.map(|(mask,_)|mask).unwrap_or(0);let hold=state.hold.load(Ordering::SeqCst)&&mask!=0;
 trace(&app,&format!("open ticket={ticket} hold={hold} mask={mask}"));
 window.emit("materials-quick-refresh",serde_json::json!({"hold":hold,"ticket":ticket})).map_err(|e|e.to_string())?;window.show().map_err(|e|e.to_string())?;
 #[cfg(windows)] if hold{if !crate::platform::watch_quick_release(window.hwnd().map_err(|e|e.to_string())?.0 as usize,state.target.load(Ordering::SeqCst),mask,ticket){release(&app,ticket);}}
 Ok(())
}
#[tauri::command]
pub fn materials_quick_abort(w:tauri::WebviewWindow,app:tauri::AppHandle,ticket:u64,message:Option<String>)->Result<(),String>{if w.label()!="main"{return Err("Manager only".into());}let state=app.state::<QuickMaterials>();if state.generation.load(Ordering::SeqCst)==ticket{state.pending.store(false,Ordering::SeqCst);if let Some(message)=message{let _=app.emit_to("materials-quick","materials-quick-feedback",message);}}Ok(())}
pub fn release(app:&tauri::AppHandle,ticket:u64){trace(app,&format!("native-release ticket={ticket} visible={} focused={}",visible(app),app.get_webview_window("materials-quick").is_some_and(|w|w.is_focused().unwrap_or(false))));if app.state::<QuickMaterials>().generation.load(Ordering::SeqCst)==ticket&&app.get_webview_window("materials-quick").is_some_and(|w|w.is_visible().unwrap_or(false)&&(w.is_focused().unwrap_or(false)||crate::platform::foreground_target()==Some(app.state::<QuickMaterials>().target.load(Ordering::SeqCst)))){#[cfg(windows)] crate::platform::cancel_quick_watch();let _=app.emit_to("materials-quick","materials-quick-release",serde_json::json!({"verified":true,"ticket":ticket}));}}
pub fn key(app:&tauri::AppHandle,key:u32){if !visible(app){return;}let name=match key{0x25=>"ArrowLeft",0x26=>"ArrowUp",0x27=>"ArrowRight",0x28=>"ArrowDown",0x24=>"Home",0x23=>"End",0x0d=>"Enter",0x1b=>"Escape",_=>return};let _=app.emit_to("materials-quick","materials-quick-key",name);}
pub fn request_paste(app:&tauri::AppHandle)->Result<(),String>{app.state::<QuickMaterials>().clear_pending.store(false,Ordering::SeqCst);#[cfg(windows)] crate::platform::cancel_quick_watch();trace(app,"request-paste");let ticket=app.state::<QuickMaterials>().generation.load(Ordering::SeqCst);app.emit_to("main","materials-quick-paste-request",ticket).map_err(|e|e.to_string())}
#[tauri::command]
pub fn materials_quick_action(w:tauri::WebviewWindow,app:tauri::AppHandle,action:String)->Result<(),String>{
 allowed(&w)?;match action.as_str(){"clear-confirm"=>{let state=app.state::<QuickMaterials>();if !visible(&app){return Err("Quick materials is closed".into());}state.clear_pending.store(true,Ordering::SeqCst);#[cfg(windows)]if let Some(window)=app.get_webview_window("materials-quick"){crate::platform::watch_quick_release(window.hwnd().map_err(|e|e.to_string())?.0 as usize,state.target.load(Ordering::SeqCst),0,state.generation.load(Ordering::SeqCst));}trace(&app,"clear-confirm-ready");Ok(())},"clear"=>{let state=app.state::<QuickMaterials>();if !state.clear_pending.load(Ordering::SeqCst)||!visible(&app){return Err("Confirm clear first".into());}app.emit_to("main","materials-quick-clear-request",state.generation.load(Ordering::SeqCst)).map_err(|e|e.to_string())},"toggle"=>request_toggle(&app,false),"close"=>close(&app),"paste"=>request_paste(&app),"main"=>{
  #[cfg(windows)] crate::platform::cancel_quick_watch();
  let state=app.state::<QuickMaterials>();state.generation.fetch_add(1,Ordering::SeqCst);state.pending.store(false,Ordering::SeqCst);if let Some(w)=app.get_webview_window("materials-quick"){let _=w.hide();let _=w.emit("materials-quick-hidden",());}
  let target=state.target.load(Ordering::SeqCst);if target!=0{crate::manage_from_target(&app,target);}else{crate::manage(&app);}app.emit_to("main","material-action","show").map_err(|e|e.to_string())
 },_=>Err("Unknown quick materials action".into())}
}
#[tauri::command]
pub async fn materials_quick_finish_paste(w:tauri::WebviewWindow,app:tauri::AppHandle,ticket:u64)->Result<(),String>{
 trace(&app,&format!("finish-paste ticket={ticket}"));
 if w.label()!="main"{return Err("Manager only".into());}
 let state=app.state::<QuickMaterials>();if state.generation.load(Ordering::SeqCst)!=ticket||!visible(&app){return Ok(());}
 let target=state.target.load(Ordering::SeqCst);let window=app.get_webview_window("materials-quick").ok_or("Quick materials unavailable")?;
 if target!=0{if !window.is_focused().unwrap_or(false)&&crate::platform::foreground_target()!=Some(target){trace(&app,"paste rejected: foreground changed");return Err("Window changed; paste cancelled".into());}if let Err(error)=crate::platform::focus_target(target){trace(&app,&format!("focus-return failed: {error}"));return Err(error);}trace(&app,"focus-return succeeded");window.hide().map_err(|e|e.to_string())?;let _=window.emit("materials-quick-hidden",());}
 let result=crate::materials::materials_paste_all(w,app.clone(),if target==0{None}else{Some(target)}).await;
 trace(&app,&format!("paste-result {:?}",result));
 if result.is_err(){let _=window.show();let _=window.set_focus();}
 let key=if result.is_ok(){if target==0{"已複製全部素材；請切到支援附件的對話框貼上。"}else{"已執行素材貼上；請確認附件完整後再送出。"}}else{"素材貼上失敗，請重新開啟面板後重試。"};
 let _=app.emit_to("materials-quick","materials-quick-feedback",key);result
}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn manager_dismiss_invalidates_pending_open_and_release_state(){let state=QuickMaterials::default();state.generation.store(7,Ordering::SeqCst);state.pending.store(true,Ordering::SeqCst);state.hold.store(true,Ordering::SeqCst);state.clear_pending.store(true,Ordering::SeqCst);state.cancel();assert!(!state.clear_pending.load(Ordering::SeqCst));assert!(!state.consume(7));assert!(!state.pending.load(Ordering::SeqCst));assert!(!state.hold.load(Ordering::SeqCst));state.pending.store(true,Ordering::SeqCst);assert!(state.consume(8));assert!(!state.consume(8));}
 #[test]fn only_manager_and_quick_reader_allowed(){for label in ["main","materials-quick"]{assert!(reader_label(label));}for label in ["picker","capture","recording-controls",""]{assert!(!reader_label(label));}}
 #[test]fn stale_cancelled_or_duplicate_open_never_consumes_new_request(){let state=QuickMaterials::default();state.generation.store(2,Ordering::SeqCst);state.pending.store(true,Ordering::SeqCst);assert!(!state.consume(1));assert!(state.pending.load(Ordering::SeqCst));assert!(state.consume(2));assert!(!state.consume(2));state.pending.store(true,Ordering::SeqCst);state.generation.fetch_add(1,Ordering::SeqCst);assert!(!state.consume(2));assert!(state.consume(3));}
}

#[tauri::command]
pub async fn materials_quick_finish_clear(w:tauri::WebviewWindow,app:tauri::AppHandle,ticket:u64)->Result<(),String>{
 if w.label()!="main"{return Err("Manager only".into());}let state=app.state::<QuickMaterials>();if state.generation.load(Ordering::SeqCst)!=ticket||!visible(&app)||!state.clear_pending.swap(false,Ordering::SeqCst){return Ok(());}let handle=app.clone();let result=tauri::async_runtime::spawn_blocking(move||{if handle.state::<crate::recording::Recorder>().active(){return Err("Finish recording first".into());}handle.state::<crate::materials::Materials>().workspace_action("clear",None,None).map(|_|())}).await.map_err(|e|e.to_string())?;match result{Ok(())=>{let _=app.emit_to("main","materials-updated",());close(&app)?;trace(&app,"quick-clear-done");Ok(())},Err(error)=>{state.clear_pending.store(true,Ordering::SeqCst);let _=app.emit_to("materials-quick","materials-quick-feedback",error.clone());Err(error)}}
}
