use serde::Serialize;
use std::fmt;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod windows;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(windows)]
use windows as platform;
#[cfg(not(any(windows, target_os = "macos")))]
mod platform {
    use super::*;
    pub fn track() {}
    pub fn target() -> Result<usize, CaptureError> {
        Err(CaptureError::Unsupported)
    }
    pub fn capture(_: CaptureRequest) -> Result<Frame, CaptureError> {
        Err(CaptureError::Unsupported)
    }
    pub fn capabilities() -> Capabilities {
        Capabilities::unsupported("other", CaptureError::Unsupported)
    }
    pub fn request_permission() -> Result<(), CaptureError> {
        Err(CaptureError::Unsupported)
    }
    pub fn open_permissions() -> Result<(), CaptureError> {
        Err(CaptureError::Unsupported)
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CaptureMode {
    Region,
    Fullscreen,
    Window,
}
impl std::str::FromStr for CaptureMode {
    type Err = CaptureError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "region" => Ok(Self::Region),
            "fullscreen" => Ok(Self::Fullscreen),
            "window" => Ok(Self::Window),
            _ => Err(CaptureError::InvalidMode),
        }
    }
}
#[derive(Clone, Copy, Debug)]
pub struct CaptureRequest {
    pub mode: CaptureMode,
    pub target: usize,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CaptureError {
    Unsupported,
    OsVersion,
    PermissionRequired,
    TargetUnavailable,
    InvalidMode,
    InvalidBounds,
    TooLarge,
    Native,
    Timeout,
    StaleSession,
    Settings,
}
impl fmt::Display for CaptureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Unsupported => "error.capture_unsupported",
            Self::OsVersion => "error.capture_macos_version",
            Self::PermissionRequired => "error.capture_permission",
            Self::TargetUnavailable => "error.capture_target",
            Self::InvalidMode => "error.capture_mode",
            Self::InvalidBounds => "error.capture_bounds",
            Self::TooLarge => "error.capture_large",
            Self::Native => "error.capture_native",
            Self::Timeout => "error.capture_timeout",
            Self::StaleSession => "error.capture_session",
            Self::Settings => "error.capture_settings",
        })
    }
}
impl std::error::Error for CaptureError {}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    NotRequired,
    Granted,
    Required,
    Unavailable,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub platform: String,
    pub supported: bool,
    pub permission: Permission,
    pub reason: Option<String>,
    pub window_semantics: String,
}
impl Capabilities {
    pub fn unsupported(platform: &str, error: CaptureError) -> Self {
        Self {
            platform: platform.into(),
            supported: false,
            permission: Permission::Unavailable,
            reason: Some(error.to_string()),
            window_semantics: "unavailable".into(),
        }
    }
    pub fn can_capture(&self) -> bool {
        self.supported
            && matches!(
                self.permission,
                Permission::Granted | Permission::NotRequired
            )
    }
}
pub const MAX_PIXELS: u64 = 64_000_000;
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LogicalBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
impl LogicalBounds {
    pub fn validate_raster(&self, width: u32, height: u32) -> Result<(), CaptureError> {
        checked_len(width, height)?;
        if ![self.x, self.y, self.width, self.height]
            .iter()
            .all(|v| v.is_finite())
            || self.width <= 0.0
            || self.height <= 0.0
        {
            return Err(CaptureError::InvalidBounds);
        }
        let scale = f64::from(width) / self.width;
        if !(0.99..=4.01).contains(&scale) || (self.height * scale - f64::from(height)).abs() > 2.0
        {
            return Err(CaptureError::InvalidBounds);
        }
        Ok(())
    }
}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CandidateKind {
    Window,
    Client,
    Control,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct Candidate {
    pub id: u32,
    pub parent: u32,
    pub group: u32,
    pub kind: CandidateKind,
    pub rect: [u32; 4],
}
impl Candidate {
    pub fn from_desktop(
        id: u32,
        parent: u32,
        group: u32,
        kind: CandidateKind,
        rect: [i32; 4],
        desktop: [i32; 4],
    ) -> Option<Self> {
        let clipped = clip_rect(rect, desktop).ok()?;
        let x = u32::try_from(i64::from(clipped[0]) - i64::from(desktop[0])).ok()?;
        let y = u32::try_from(i64::from(clipped[1]) - i64::from(desktop[1])).ok()?;
        Some(Self {
            id,
            parent,
            group,
            kind,
            rect: [x, y, clipped[2] as u32, clipped[3] as u32],
        })
    }
    pub fn valid_in(&self, width: u32, height: u32) -> bool {
        let [x, y, w, h] = self.rect;
        self.id > 0
            && self.group > 0
            && w > 0
            && h > 0
            && x.checked_add(w).is_some_and(|right| right <= width)
            && y.checked_add(h).is_some_and(|bottom| bottom <= height)
    }
}
#[derive(Clone)]
pub struct Frame {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
    /// Some only when the native desktop uses logical points (macOS). Bitmap pixels stay independent.
    pub logical_bounds: Option<LogicalBounds>,
    pub candidates: Vec<Candidate>,
}
impl Frame {
    pub fn new(
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        rgba: Vec<u8>,
    ) -> Result<Self, CaptureError> {
        let len = checked_len(width, height)?;
        if rgba.len() != len {
            return Err(CaptureError::InvalidBounds);
        }
        Ok(Self {
            x,
            y,
            width,
            height,
            rgba,
            logical_bounds: None,
            candidates: Vec::new(),
        })
    }
    pub fn png(&self) -> Result<Vec<u8>, String> {
        if checked_len(self.width, self.height).map_err(|e| e.to_string())? != self.rgba.len() {
            return Err(CaptureError::InvalidBounds.to_string());
        }
        let mut data = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut data, self.width, self.height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
            writer
                .write_image_data(&self.rgba)
                .map_err(|e| e.to_string())?;
        }
        Ok(data)
    }
    pub fn crop(&self, x: u32, y: u32, width: u32, height: u32) -> Result<Self, String> {
        if x.checked_add(width).is_none_or(|v| v > self.width)
            || y.checked_add(height).is_none_or(|v| v > self.height)
        {
            return Err(CaptureError::InvalidBounds.to_string());
        }
        let len = checked_len(width, height).map_err(|e| e.to_string())?;
        let out_x = self
            .x
            .checked_add(i32::try_from(x).map_err(|_| CaptureError::InvalidBounds.to_string())?)
            .ok_or(CaptureError::InvalidBounds.to_string())?;
        let out_y = self
            .y
            .checked_add(i32::try_from(y).map_err(|_| CaptureError::InvalidBounds.to_string())?)
            .ok_or(CaptureError::InvalidBounds.to_string())?;
        if self.rgba.len() != checked_len(self.width, self.height).map_err(|e| e.to_string())? {
            return Err(CaptureError::InvalidBounds.to_string());
        }
        let mut rgba = Vec::with_capacity(len);
        for row in y..y + height {
            let start = (row as usize * self.width as usize + x as usize) * 4;
            rgba.extend_from_slice(&self.rgba[start..start + width as usize * 4]);
        }
        Self::new(out_x, out_y, width, height, rgba).map_err(|e| e.to_string())
    }
}
pub fn checked_len(width: u32, height: u32) -> Result<usize, CaptureError> {
    if width == 0 || height == 0 {
        return Err(CaptureError::InvalidBounds);
    }
    let count = u64::from(width) * u64::from(height);
    if count > MAX_PIXELS {
        return Err(CaptureError::TooLarge);
    }
    usize::try_from(count * 4).map_err(|_| CaptureError::TooLarge)
}
/// Intersect desktop coordinates using i64 arithmetic to reject overflow, gaps and off-screen windows.
pub fn clip_rect(rect: [i32; 4], desktop: [i32; 4]) -> Result<[i32; 4], CaptureError> {
    let [x, y, w, h] = rect;
    let [dx, dy, dw, dh] = desktop;
    if w <= 0 || h <= 0 || dw <= 0 || dh <= 0 {
        return Err(CaptureError::InvalidBounds);
    }
    let left = i64::from(x).max(i64::from(dx));
    let top = i64::from(y).max(i64::from(dy));
    let right = (i64::from(x) + i64::from(w)).min(i64::from(dx) + i64::from(dw));
    let bottom = (i64::from(y) + i64::from(h)).min(i64::from(dy) + i64::from(dh));
    if right <= left || bottom <= top {
        return Err(CaptureError::TargetUnavailable);
    }
    Ok([
        i32::try_from(left).map_err(|_| CaptureError::InvalidBounds)?,
        i32::try_from(top).map_err(|_| CaptureError::InvalidBounds)?,
        i32::try_from(right - left).map_err(|_| CaptureError::InvalidBounds)?,
        i32::try_from(bottom - top).map_err(|_| CaptureError::InvalidBounds)?,
    ])
}
pub fn is_current(request: u64, current: u64, busy: bool) -> bool {
    request == current && busy
}
pub fn check_session(
    current: u64,
    received: Option<u64>,
    has_selection: bool,
) -> Result<(), CaptureError> {
    if has_selection && received != Some(current) || received.is_some_and(|value| value != current)
    {
        Err(CaptureError::StaleSession)
    } else {
        Ok(())
    }
}
pub fn track() {
    platform::track()
}
pub fn target() -> Result<usize, String> {
    platform::target().map_err(|e| e.to_string())
}
pub fn capture(mode: &str, target: usize) -> Result<Frame, String> {
    let mode = mode.parse::<CaptureMode>().map_err(|e| e.to_string())?;
    let caps = capabilities();
    if !caps.can_capture() {
        return Err(caps
            .reason
            .unwrap_or(CaptureError::PermissionRequired.to_string()));
    }
    platform::capture(CaptureRequest { mode, target }).map_err(|e| e.to_string())
}
pub fn capabilities() -> Capabilities {
    platform::capabilities()
}
pub fn request_permission() -> Result<Capabilities, String> {
    platform::request_permission().map_err(|e| e.to_string())?;
    Ok(capabilities())
}
pub fn open_permissions() -> Result<(), String> {
    platform::open_permissions().map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn candidate_rectangles_clip_negative_desktops_without_exposing_text() {
        let c = Candidate::from_desktop(
            1,
            0,
            1,
            CandidateKind::Window,
            [-2000, -10, 200, 100],
            [-1920, 0, 3840, 1080],
        )
        .unwrap();
        assert_eq!(c.rect, [0, 0, 120, 90]);
        assert!(c.valid_in(3840, 1080));
        assert!(Candidate::from_desktop(
            2,
            1,
            1,
            CandidateKind::Control,
            [2000, 0, 100, 100],
            [-1920, 0, 3840, 1080]
        )
        .is_none());
        assert!(!Candidate {
            id: 2,
            parent: 1,
            group: 1,
            kind: CandidateKind::Control,
            rect: [u32::MAX, 0, 5, 5]
        }
        .valid_in(100, 100));
        let json = serde_json::to_value(c).unwrap();
        assert_eq!(json.as_object().unwrap().len(), 5);
        assert!(json.get("title").is_none());
        assert!(json.get("handle").is_none());
    }
    #[test]
    fn modes_and_errors_are_stable() {
        for mode in ["region", "fullscreen", "window"] {
            assert!(mode.parse::<CaptureMode>().is_ok())
        }
        assert_eq!(
            "wrong".parse::<CaptureMode>(),
            Err(CaptureError::InvalidMode)
        );
        for e in [
            CaptureError::Unsupported,
            CaptureError::OsVersion,
            CaptureError::PermissionRequired,
            CaptureError::TargetUnavailable,
            CaptureError::InvalidMode,
            CaptureError::InvalidBounds,
            CaptureError::TooLarge,
            CaptureError::Native,
            CaptureError::Timeout,
            CaptureError::StaleSession,
            CaptureError::Settings,
        ] {
            assert!(e.to_string().starts_with("error.capture_"));
        }
    }
    #[test]
    fn image_bounds_and_memory_are_checked() {
        assert_eq!(checked_len(0, 1), Err(CaptureError::InvalidBounds));
        assert_eq!(checked_len(u32::MAX, u32::MAX), Err(CaptureError::TooLarge));
        assert!(Frame::new(0, 0, 1, 1, vec![1, 2, 3]).is_err());
        assert!(Frame::new(i32::MAX, 0, 1, 1, vec![1, 2, 3, 255])
            .unwrap()
            .crop(1, 0, 1, 1)
            .is_err());
    }
    #[test]
    fn physical_desktop_intersection_handles_negative_origins_and_overflow() {
        assert_eq!(
            clip_rect([-2000, -50, 300, 200], [-1920, 0, 3840, 1080]).unwrap(),
            [-1920, 0, 220, 150]
        );
        assert!(clip_rect([i32::MAX, 0, i32::MAX, 200], [0, 0, 1920, 1080]).is_err());
        assert!(clip_rect([0, 0, 0, 1], [0, 0, 100, 100]).is_err());
    }
    #[test]
    fn css_to_pixels_geometry_does_not_conflate_retina_points() {
        let b = LogicalBounds {
            x: -1920.0,
            y: -200.0,
            width: 3840.0,
            height: 1280.0,
        };
        assert!(b.validate_raster(7680, 2560).is_ok());
        assert!(b.validate_raster(5760, 1920).is_ok());
        assert!(b.validate_raster(3840, 1280).is_ok());
        assert!(b.validate_raster(7680, 1280).is_err());
        assert!(LogicalBounds { x: f64::NAN, ..b }
            .validate_raster(3840, 1280)
            .is_err());
        assert!(b.validate_raster(u32::MAX, u32::MAX).is_err());
    }
    #[test]
    fn stale_selection_cannot_write_to_a_later_capture() {
        assert!(check_session(2, Some(1), true).is_err());
        assert!(!is_current(1, 2, true));
        assert!(!is_current(2, 2, false));
        assert!(is_current(2, 2, true));
        assert!(check_session(2, None, true).is_err());
        assert!(check_session(2, Some(2), true).is_ok());
        assert!(check_session(2, None, false).is_ok());
        assert!(check_session(2, Some(1), false).is_err());
    }
}
