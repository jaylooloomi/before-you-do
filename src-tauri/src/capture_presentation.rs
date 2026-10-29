//! A prepared bitmap is painted at alpha zero before the native window becomes opaque.
pub fn alpha(window:&tauri::WebviewWindow,value:u8)->Result<(),String>{
 #[cfg(windows)]unsafe{
  use windows_sys::Win32::UI::WindowsAndMessaging::*;let hwnd=window.hwnd().map_err(|e|e.to_string())?.0 as _;
  let style=GetWindowLongPtrW(hwnd,GWL_EXSTYLE);let next=if value==0{style|WS_EX_LAYERED as isize|WS_EX_NOACTIVATE as isize}else{(style|WS_EX_LAYERED as isize)&!(WS_EX_NOACTIVATE as isize)};SetWindowLongPtrW(hwnd,GWL_EXSTYLE,next);
  if value==255 {windows_sys::Win32::Graphics::Dwm::DwmFlush();}
  if SetLayeredWindowAttributes(hwnd,0,value,LWA_ALPHA)==0{return Err("Cannot prepare capture opacity".into());}
 }
 #[cfg(target_os="macos")]unsafe{extern "C"{fn byd_capture_window_alpha(window:*mut std::ffi::c_void,alpha:f64);}byd_capture_window_alpha(window.ns_window().map_err(|e|e.to_string())?,value as f64/255.0);}
 #[cfg(not(any(windows,target_os="macos")))]let _=(window,value);
 Ok(())
}
pub fn prime(window:&tauri::WebviewWindow)->Result<(),String>{
 alpha(window,0)?;
 #[cfg(windows)]unsafe{use windows_sys::Win32::UI::WindowsAndMessaging::*;ShowWindow(window.hwnd().map_err(|e|e.to_string())?.0 as _,SW_SHOWNOACTIVATE);}
 #[cfg(not(windows))]
 window.show().map_err(|e|e.to_string())?;
 alpha(window,0)
}
pub fn present(window:&tauri::WebviewWindow)->Result<(),String>{
 alpha(window,255)?;
 #[cfg(windows)]unsafe{use windows_sys::Win32::UI::WindowsAndMessaging::*;let hwnd=window.hwnd().map_err(|e|e.to_string())?.0 as _;SetForegroundWindow(hwnd);windows_sys::Win32::UI::Input::KeyboardAndMouse::SetFocus(hwnd);let webview:&tauri::Webview=window.as_ref();webview.set_focus().map_err(|e|e.to_string())?;}
 #[cfg(not(windows))]window.set_focus().map_err(|e|e.to_string())?;
 Ok(())
}
pub fn hide(window:&tauri::WebviewWindow)->Result<(),String>{
 // This isolated overlay uses native visibility consistently. Tao's cached VISIBLE flag
 // would otherwise skip hiding a window shown with SW_SHOWNOACTIVATE.
 #[cfg(windows)]unsafe{windows_sys::Win32::UI::WindowsAndMessaging::ShowWindow(window.hwnd().map_err(|e|e.to_string())?.0 as _,windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE);}
 #[cfg(not(windows))]window.hide().map_err(|e|e.to_string())?;
 Ok(())
}
pub fn pointer(frame:&crate::capture::Frame)->[f64;2]{
 let mut position=None;
 #[cfg(windows)]unsafe{let mut p:windows_sys::Win32::Foundation::POINT=std::mem::zeroed();if windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut p)!=0{position=Some((p.x as f64,p.y as f64));}}
 #[cfg(target_os="macos")]unsafe{extern "C"{fn byd_capture_cursor(x:*mut f64,y:*mut f64)->bool;}let(mut x,mut y)=(0.0,0.0);if byd_capture_cursor(&mut x,&mut y){position=Some((x,y));}}
 let (x,y)=position.unwrap_or((frame.x as f64+frame.width as f64/2.0,frame.y as f64+frame.height as f64/2.0));
 if let Some(bounds)=frame.logical_bounds.as_ref(){return project_pointer([x,y],[bounds.x,bounds.y,bounds.width,bounds.height],[frame.width,frame.height]);}
 project_pointer([x,y],[frame.x as f64,frame.y as f64,frame.width as f64,frame.height as f64],[frame.width,frame.height])
}
pub fn project_pointer(point:[f64;2],bounds:[f64;4],size:[u32;2])->[f64;2]{[
 ((point[0]-bounds[0])*size[0]as f64/bounds[2]).clamp(0.0,size[0].saturating_sub(1)as f64),
 ((point[1]-bounds[1])*size[1]as f64/bounds[3]).clamp(0.0,size[1].saturating_sub(1)as f64)]}
#[cfg(test)]mod tests{use super::*;#[test]fn pointer_projection_handles_negative_origin_retina_and_edges(){assert_eq!(project_pointer([-1700.0,200.0],[-1920.0,0.0,3840.0,1080.0],[3840,1080]),[220.0,200.0]);assert_eq!(project_pointer([200.0,100.0],[0.0,0.0,1000.0,600.0],[2000,1200]),[400.0,200.0]);assert_eq!(project_pointer([-10.0,900.0],[0.0,0.0,100.0,100.0],[100,100]),[0.0,99.0]);}}
