use base64::Engine;
use std::sync::atomic::{AtomicU64,Ordering};
use tauri::{Emitter,Manager};
static GENERATION:AtomicU64=AtomicU64::new(0);
pub fn dismiss(app:&tauri::AppHandle){GENERATION.fetch_add(1,Ordering::SeqCst);if let Some(w)=app.get_webview_window("capture-toast"){let _=w.hide();}}
pub fn notify(app:&tauri::AppHandle,frame:&crate::capture::Frame){
    let result=(||->Result<(),Box<dyn std::error::Error>>{
        let w=app.get_webview_window("capture-toast").ok_or("Preview unavailable")?;
        let thumbnail=image::RgbaImage::from_raw(frame.width,frame.height,frame.rgba.clone()).ok_or("Invalid screenshot")?;
        let thumbnail=image::DynamicImage::ImageRgba8(thumbnail).thumbnail(640,400);
        let mut png=std::io::Cursor::new(Vec::new());thumbnail.write_to(&mut png,image::ImageFormat::Png)?;
        let monitor=app.monitor_from_point(frame.x as f64+frame.width as f64/2.0,frame.y as f64+frame.height as f64/2.0)?.or(app.primary_monitor()?);
        if let Some(m)=monitor {let a=m.work_area();let scale=m.scale_factor();let (x,y,width,height)=placement(a.position.x,a.position.y,a.size.width,a.size.height,scale);w.set_size(tauri::PhysicalSize::new(width,height))?;w.set_position(tauri::PhysicalPosition::new(x,y))?;}
        let generation=GENERATION.fetch_add(1,Ordering::SeqCst)+1;
        w.emit("capture-preview",serde_json::json!({"generation":generation,"image":format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(png.into_inner()))}))?;
        Ok(())
    })();if let Err(e)=result{eprintln!("Screenshot preview: {e}");}
}
#[tauri::command]
pub fn capture_toast_ready(w:tauri::WebviewWindow,generation:u64)->Result<(),String>{
    if w.label()!="capture-toast"{return Err("Preview window only".into());}
    if generation!=GENERATION.load(Ordering::SeqCst){return Ok(());}
    w.show().map_err(|e|e.to_string())?;
    std::thread::spawn(move||{std::thread::sleep(std::time::Duration::from_secs(4));let app=w.app_handle().clone();let _=app.run_on_main_thread(move||{if generation==GENERATION.load(Ordering::SeqCst){let _=w.hide();}});});Ok(())
}
#[tauri::command]
pub fn capture_toast_hide(w:tauri::WebviewWindow)->Result<(),String>{if w.label()!="capture-toast"{return Err("Preview window only".into());}GENERATION.fetch_add(1,Ordering::SeqCst);w.hide().map_err(|e|e.to_string())}

fn placement(x:i32,y:i32,width:u32,height:u32,scale:f64)->(i32,i32,u32,u32){let scale=if scale.is_finite()&&scale>0.0{scale}else{1.0};let margin=(16.0*scale).round()as u32;let w=((320.0*scale).round()as u32).min(width.saturating_sub(margin*2).max(1));let h=((220.0*scale).round()as u32).min(height.saturating_sub(margin*2).max(1));(x.saturating_add(width.saturating_sub(w+margin)as i32),y.saturating_add(height.saturating_sub(h+margin)as i32),w,h)}
#[cfg(test)]mod tests{use super::*;#[test]fn preview_fits_work_area_and_negative_monitor_at_high_dpi(){assert_eq!(placement(0,0,1920,1040,1.0),(1584,804,320,220));assert_eq!(placement(-2560,-200,2560,1400,1.5),(-504,846,480,330));let(x,y,w,h)=placement(0,0,200,100,1.0);assert!(x>=0&&y>=0&&x+w as i32<=200&&y+h as i32<=100);}}
