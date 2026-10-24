//! Explicit opt-in native window regression; never runs during normal startup.
use std::{io::Write, sync::mpsc, time::Duration};
use tauri::Manager;

fn enabled() -> bool {
    std::env::args().any(|arg| arg == "--window-regression")
}

pub fn record(stage: &str, window: &tauri::WebviewWindow) {
    if !enabled() {
        return;
    }
    let state = crate::window_shape::inspect(window);
    let pass = if state["maximized"] == true {
        state["region_kind"] == 0 && state["client_covers_work_area"] == true
    } else {
        state["rounded"] == true && state["non_client_frame_excluded"] == true
    };
    let row = serde_json::json!({"stage":stage,"pass":pass,"state":state});
    if let Ok(exe) = std::env::current_exe() {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(exe.with_extension("window-regression.jsonl"))
        {
            let _ = writeln!(file, "{row}");
        }
    }
}

pub fn start(app: &tauri::AppHandle) {
    if !enabled() {
        return;
    }
    // Keep the explicitly requested visual test visible for desktop pixel
    // capture, even when another app is active. Restore normal stacking below.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(true);
    }
    if let Ok(exe) = std::env::current_exe() {
        let _ = std::fs::write(exe.with_extension("window-regression.jsonl"), "");
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(3));
        for (stage, width, height, maximize) in [
            ("initial", 940., 720., false),
            ("minimum", 780., 680., false),
            ("enlarged", 1200., 800., false),
            ("resized", 900., 700., false),
            ("maximized-1", 0., 0., true),
            ("restored-1", 900., 700., false),
            ("maximized-2", 0., 0., true),
            ("restored-2", 940., 720., false),
        ] {
            let h = app.clone();
            let (tx, rx) = mpsc::channel();
            let _ = app.run_on_main_thread(move || {
                if let Some(w) = h.get_webview_window("main") {
                    // Theme initialization can update native styles after setup.
                    // Reassert test-only stacking for each screenshot stage.
                    let _ = w.set_always_on_top(true);
                    let result = if maximize {
                        w.maximize()
                    } else {
                        w.unmaximize()
                            .and_then(|_| w.set_size(tauri::LogicalSize::new(width, height)))
                    };
                    let _ = tx.send(result.map_err(|e| e.to_string()));
                }
            });
            if !matches!(rx.recv_timeout(Duration::from_secs(3)), Ok(Ok(()))) {
                return;
            }
            // Observe after real resize/maximize events; do not manually apply the mask.
            std::thread::sleep(Duration::from_millis(650));
            let h = app.clone();
            let (tx, rx) = mpsc::channel();
            let _ = app.run_on_main_thread(move || {
                if let Some(w) = h.get_webview_window("main") {
                    record(stage, &w);
                }
                let _ = tx.send(());
            });
            if rx.recv_timeout(Duration::from_secs(3)).is_err() {
                return;
            }
        }
        let h = app.clone();
        let _ = app.run_on_main_thread(move || {
            if let Some(window) = h.get_webview_window("main") {
                let _ = window.set_always_on_top(false);
            }
        });
    });
}
