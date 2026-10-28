#[derive(Debug, PartialEq)]
pub struct Placement {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

// All positions/sizes are physical pixels. Only desired size and margin are logical.
#[cfg(test)]
pub fn placement(x: i32, y: i32, width: u32, height: u32, scale: f64) -> Placement {
    placement_with_size(x, y, width, height, scale, 580.0, 480.0)
}
fn placement_with_size(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale: f64,
    desired_width: f64,
    desired_height: f64,
) -> Placement {
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    let fit = |available: u32, desired: f64| {
        let available = available.max(1);
        let margin = (16.0 * scale)
            .round()
            .min((available.saturating_sub(1) / 2) as f64) as u32;
        ((desired * scale).round() as u32)
            .max(1)
            .min(available - margin * 2)
    };
    let w = fit(width, desired_width);
    let h = fit(height, desired_height);
    Placement {
        x: x.saturating_add((width.saturating_sub(w) / 2) as i32),
        y: y.saturating_add((height.saturating_sub(h) / 2) as i32),
        width: w,
        height: h,
    }
}
fn desired_size(window: &tauri::WebviewWindow) -> tauri::Result<(f64, f64)> {
    if window.label() == "main" {
        if window.is_maximized()? || window.is_minimized()? {
            return Ok((940.0, 820.0));
        }
        let size = window
            .inner_size()?
            .to_logical::<f64>(window.scale_factor()?);
        Ok((size.width, size.height))
    } else {
        Ok((580.0, 480.0))
    }
}

pub fn position(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    target: usize,
) -> tauri::Result<()> {
    let desired = desired_size(window)?;
    position_sized(app, window, target, desired)
}
pub fn prepare_manager(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    target: usize,
) -> tauri::Result<()> {
    // Capture logical size once: don't rescale twice while a DPI change is being delivered.
    let desired = desired_size(window)?;
    position_sized(app, window, target, desired)?;
    window.unmaximize()?;
    window.unminimize()?;
    position_sized(app, window, target, desired)
}
fn position_sized(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    target: usize,
    desired: (f64, f64),
) -> tauri::Result<()> {
    // The target HWND determines the monitor, even if the mouse or manager is elsewhere.
    let target_monitor = crate::platform::target_monitor_point(target)
        .and_then(|(x, y)| app.monitor_from_point(x as f64, y as f64).ok().flatten());
    let cursor_monitor = || {
        app.cursor_position()
            .ok()
            .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
    };
    let monitor = target_monitor
        .or_else(cursor_monitor)
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let area = monitor.work_area();
        let p = placement_with_size(
            area.position.x,
            area.position.y,
            area.size.width,
            area.size.height,
            monitor.scale_factor(),
            desired.0,
            desired.1,
        );
        // Move first to adopt the target DPI, then explicitly size and center in pixels.
        window.set_position(tauri::PhysicalPosition::new(p.x, p.y))?;
        if window.label() == "main" {
            window.set_min_size(Some(tauri::PhysicalSize::new(
                (780.0 * monitor.scale_factor()).round().min(p.width as f64) as u32,
                (680.0 * monitor.scale_factor())
                    .round()
                    .min(p.height as f64) as u32,
            )))?;
        }
        window.set_size(tauri::PhysicalSize::new(p.width, p.height))?;
        window.set_position(tauri::PhysicalPosition::new(p.x, p.y))?;
    }
    Ok(())
}

// Explicit diagnostic mode: hidden fixture windows only; no keyboard/mouse input or focus changes.
#[cfg(windows)]
pub fn audit_if_requested(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::Manager;
    use windows_sys::Win32::{
        Foundation::HWND, System::LibraryLoader::GetModuleHandleW, UI::WindowsAndMessaging::*,
    };
    if !std::env::args().any(|arg| arg == "--picker-position-audit") {
        return Ok(());
    }
    if !app.state::<crate::State>().preview {
        return Err("Audit requires isolated preview mode".into());
    }
    struct Fixture(HWND);
    impl Drop for Fixture {
        fn drop(&mut self) {
            unsafe {
                DestroyWindow(self.0);
            }
        }
    }
    let windows = [
        app.get_webview_window("picker").ok_or("Picker missing")?,
        app.get_webview_window("main").ok_or("Manager missing")?,
    ];
    let class: Vec<u16> = "STATIC".encode_utf16().chain(Some(0)).collect();
    let mut checks = Vec::new();
    // Reverse the display list on the second pass to catch sticky previous-monitor placement.
    let monitors = app.available_monitors()?;
    for monitor in monitors.iter().chain(monitors.iter().rev()) {
        let area = monitor.work_area();
        let fixture = Fixture(unsafe {
            CreateWindowExW(
                0,
                class.as_ptr(),
                class.as_ptr(),
                WS_POPUP,
                area.position.x + 64,
                area.position.y + 64,
                48,
                48,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                GetModuleHandleW(std::ptr::null()),
                std::ptr::null(),
            )
        });
        if fixture.0.is_null() {
            return Err("Could not create hidden target fixture".into());
        }
        for window in &windows {
            let desired = desired_size(window)?;
            position(app, window, fixture.0 as usize)?;
            let actual = window.outer_position()?;
            let size = window.inner_size()?;
            let expected = placement_with_size(
                area.position.x,
                area.position.y,
                area.size.width,
                area.size.height,
                monitor.scale_factor(),
                desired.0,
                desired.1,
            );
            let selected = window.current_monitor()?.ok_or("Picker monitor missing")?;
            let passed = actual.x == expected.x
                && actual.y == expected.y
                && size.width == expected.width
                && size.height == expected.height
                && selected.position() == monitor.position()
                && !window.is_visible()?;
            checks.push(serde_json::json!({"window":window.label(),"monitor":monitor.name(),"scale":monitor.scale_factor(),"passed":passed,
            "x":actual.x,"y":actual.y,"width":size.width,"height":size.height,
            "expected":{"x":expected.x,"y":expected.y,"width":expected.width,"height":expected.height}}));
        }
    }
    std::fs::write(
        std::env::current_exe()?.with_extension("monitor-audit.json"),
        serde_json::to_vec_pretty(&checks)?,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manager_fits_target_work_area_and_uses_its_scale() {
        assert_eq!(
            placement_with_size(-1920, 40, 1920, 1040, 1.0, 940.0, 820.0),
            Placement {
                x: -1430,
                y: 150,
                width: 940,
                height: 820
            }
        );
        let p = placement_with_size(1920, 0, 1280, 1024, 1.5, 940.0, 820.0);
        assert_eq!(
            p,
            Placement {
                x: 1944,
                y: 24,
                width: 1232,
                height: 976
            }
        );
    }
    #[test]
    fn centers_on_target_work_area_including_negative_coordinates() {
        assert_eq!(
            placement(1920, 0, 1920, 1040, 1.0),
            Placement {
                x: 2590,
                y: 280,
                width: 580,
                height: 480
            }
        );
        assert_eq!(
            placement(-2560, -1440, 2560, 1400, 1.0),
            Placement {
                x: -1570,
                y: -980,
                width: 580,
                height: 480
            }
        );
    }
    #[test]
    fn target_scale_controls_physical_size_independent_of_previous_monitor() {
        assert_eq!(
            placement(1920, 40, 2560, 1400, 1.5),
            Placement {
                x: 2765,
                y: 380,
                width: 870,
                height: 720
            }
        );
        assert_eq!(
            placement(0, 0, 3840, 2080, 2.0),
            Placement {
                x: 1340,
                y: 560,
                width: 1160,
                height: 960
            }
        );
    }
    #[test]
    fn small_work_areas_remain_inside_bounds_without_covering_taskbar() {
        for (x, y, w, h, scale) in [
            (0, 40, 800, 560, 1.5),
            (-800, 0, 800, 600, 2.0),
            (0, 0, 10, 10, 2.0),
            (0, 0, 1, 1, 1.0),
        ] {
            let p = placement(x, y, w, h, scale);
            assert!(p.width > 0 && p.height > 0 && p.x >= x && p.y >= y);
            assert!(p.x as i64 + p.width as i64 <= x as i64 + w as i64);
            assert!(p.y as i64 + p.height as i64 <= y as i64 + h as i64);
        }
        assert_eq!(placement(0, 0, 1920, 1080, f64::NAN).width, 580);
    }
}
