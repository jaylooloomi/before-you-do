use super::*;
use std::ffi::c_int;
#[repr(C)]
struct RawImage {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    logical_x: f64,
    logical_y: f64,
    logical_width: f64,
    logical_height: f64,
    pixels: *mut u8,
    length: usize,
}
extern "C" {
    fn byd_capture_status() -> c_int;
    fn byd_capture_request() -> c_int;
    fn byd_capture_track(own_pid: i32);
    fn byd_capture_target() -> u64;
    fn byd_capture_run(window_mode: c_int, target: u64, own_pid: i32, out: *mut RawImage) -> c_int;
    fn byd_capture_free(image: *mut RawImage);
    #[cfg(test)]
    fn byd_capture_selftest() -> c_int;
}
impl Drop for RawImage {
    fn drop(&mut self) {
        unsafe { byd_capture_free(self) }
    }
}
fn code(value: c_int) -> Result<(), CaptureError> {
    match value {
        0 => Ok(()),
        1 => Err(CaptureError::OsVersion),
        2 => Err(CaptureError::PermissionRequired),
        3 => Err(CaptureError::TargetUnavailable),
        4 => Err(CaptureError::InvalidBounds),
        5 => Err(CaptureError::TooLarge),
        6 => Err(CaptureError::Timeout),
        _ => Err(CaptureError::Native),
    }
}
pub fn track() {
    unsafe { byd_capture_track(std::process::id() as i32) }
}
pub fn target() -> Result<usize, CaptureError> {
    let id = unsafe { byd_capture_target() };
    if id == 0 {
        Err(CaptureError::TargetUnavailable)
    } else {
        usize::try_from(id).map_err(|_| CaptureError::TargetUnavailable)
    }
}
pub fn capabilities() -> Capabilities {
    let state = unsafe { byd_capture_status() };
    if state == 1 {
        return Capabilities::unsupported("macos", CaptureError::OsVersion);
    }
    Capabilities {
        platform: "macos".into(),
        supported: true,
        permission: if state == 0 {
            Permission::Granted
        } else {
            Permission::Required
        },
        reason: if state == 0 {
            None
        } else {
            Some(CaptureError::PermissionRequired.to_string())
        },
        window_semantics: "independent_window".into(),
    }
}
pub fn request_permission() -> Result<(), CaptureError> {
    match unsafe { byd_capture_request() } {
        0 | 2 => Ok(()),
        n => code(n),
    }
}
pub fn open_permissions() -> Result<(), CaptureError> {
    let result = std::process::Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .status()
        .map_err(|_| CaptureError::Settings)?;
    if result.success() {
        Ok(())
    } else {
        Err(CaptureError::Settings)
    }
}
pub fn capture(request: CaptureRequest) -> Result<Frame, CaptureError> {
    let mut raw: RawImage = unsafe { std::mem::zeroed() };
    code(unsafe {
        byd_capture_run(
            i32::from(request.mode == CaptureMode::Window),
            request.target as u64,
            std::process::id() as i32,
            &mut raw,
        )
    })?;
    let expected = checked_len(raw.width, raw.height)?;
    if raw.pixels.is_null()
        || raw.length != expected
        || ![
            raw.logical_x,
            raw.logical_y,
            raw.logical_width,
            raw.logical_height,
        ]
        .iter()
        .all(|v| v.is_finite())
        || raw.logical_width <= 0.0
        || raw.logical_height <= 0.0
    {
        return Err(CaptureError::InvalidBounds);
    }
    let bytes = unsafe { std::slice::from_raw_parts(raw.pixels, raw.length) }.to_vec();
    let mut frame = Frame::new(raw.x, raw.y, raw.width, raw.height, bytes)?;
    frame.logical_bounds = Some(LogicalBounds {
        x: raw.logical_x,
        y: raw.logical_y,
        width: raw.logical_width,
        height: raw.logical_height,
    });
    frame
        .logical_bounds
        .as_ref()
        .unwrap()
        .validate_raster(frame.width, frame.height)?;
    Ok(frame)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bridge_raster_conversion_and_scaling_do_not_require_capture_permission() {
        assert_eq!(unsafe { byd_capture_selftest() }, 1);
    }
    #[test]
    fn status_codes_have_explicit_meaning() {
        assert_eq!(code(1), Err(CaptureError::OsVersion));
        assert_eq!(code(2), Err(CaptureError::PermissionRequired));
        assert_eq!(code(3), Err(CaptureError::TargetUnavailable));
        assert_eq!(code(6), Err(CaptureError::Timeout));
        assert_eq!(code(0), Ok(()));
    }
}
