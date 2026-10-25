#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod platform;
mod roles;
mod shortcut;
mod storage;
#[cfg(windows)]
mod window_regression;
mod window_shape;
use platform::Action;
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Sender},
        Mutex,
    },
};
use storage::Snippet;
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize, Default)]
struct Picker {
    items: Vec<Snippet>,
    selected: usize,
    target: usize,
    role: String,
    active: bool,
}
#[derive(Debug, PartialEq)]
enum Selection {
    Paste(usize, String),
    Add,
    Settings,
}
impl Picker {
    fn finish_in_language(&mut self, paste: bool, language: &str) -> Option<Selection> {
        match self.finish(paste) {
            Some(Selection::Paste(target, _)) => self.items.get(self.selected).map(|item| {
                Selection::Paste(target, roles::localize(item, &self.role, language).text)
            }),
            selection => selection,
        }
    }
    fn begin(&mut self, items: Vec<Snippet>, target: usize) {
        *self = Self {
            items,
            selected: 0,
            target,
            role: "personal".into(),
            active: true,
        };
    }
    fn change_role(&mut self, role: String, items: Vec<Snippet>) {
        if self.active {
            self.role = role;
            self.items = items;
            self.selected = 0;
        }
    }
    fn step(&mut self, delta: i32) {
        if self.active {
            self.selected =
                (self.selected as i32 + delta).rem_euclid(self.items.len() as i32 + 2) as usize;
        }
    }
    fn finish(&mut self, paste: bool) -> Option<Selection> {
        if !self.active {
            return None;
        }
        self.active = false;
        if paste && self.selected == self.items.len() {
            Some(Selection::Add)
        } else if paste && self.selected == self.items.len() + 1 {
            Some(Selection::Settings)
        } else if paste {
            self.items
                .get(self.selected)
                .map(|s| Selection::Paste(self.target, s.text.clone()))
        } else {
            None
        }
    }
}
struct State {
    items: Mutex<Vec<Snippet>>,
    files: Mutex<roles::KnownFiles>,
    picker: Mutex<Picker>,
    status: Mutex<String>,
    path: PathBuf,
    role: Mutex<String>,
    language: Mutex<String>,
    tx: Sender<Action>,
    pending_new: AtomicBool,
    pending_settings: AtomicBool,
    quit_approved: AtomicBool,
    shortcut: Mutex<shortcut::Shortcut>,
    shortcut_path: PathBuf,
    preview: bool,
}
struct UiMenu {
    manage: tauri::menu::MenuItem<tauri::Wry>,
    quit: tauri::menu::MenuItem<tauri::Wry>,
}
#[tauri::command]
fn set_ui_language(app: tauri::AppHandle, language: String) -> Result<(), String> {
    *app.state::<State>().language.lock().unwrap() = language.clone();
    let (manage_text, quit_text, title) = match language.as_str() {
        "zh-TW" => ("管理短句", "結束 before-you-do", "before-you-do · 常用短句"),
        "zh-CN" => ("管理短句", "退出 before-you-do", "before-you-do · 常用短句"),
        "ja" => (
            "短文を管理",
            "before-you-do を終了",
            "before-you-do · 短文ライブラリ",
        ),
        _ => (
            "Manage snippets",
            "Quit before-you-do",
            "before-you-do · Snippets",
        ),
    };
    let menu = app.state::<UiMenu>();
    menu.manage
        .set_text(manage_text)
        .map_err(|e| e.to_string())?;
    menu.quit.set_text(quit_text).map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        window.set_title(title).map_err(|e| e.to_string())?;
    }
    Ok(())
}
// Exercises the real picker state and event delivery without registering a shortcut,
// focusing a window, injecting keys, or pasting into another application.
#[tauri::command]
fn preview_picker(
    app: tauri::AppHandle,
    action: String,
    delta: Option<i32>,
) -> Result<serde_json::Value, String> {
    if !std::env::args().any(|arg| arg == "--design-preview") {
        return Err("Preview mode required".into());
    }
    let state = app.state::<State>();
    let mut picker = state.picker.lock().unwrap();
    let mut result = serde_json::Value::Null;
    match action.as_str() {
        "begin" => {
            picker.begin(state.items.lock().unwrap().clone(), 0);
            picker.role = state.role.lock().unwrap().clone();
        }
        "role" => change_picker_role(&state, &mut picker, delta.unwrap_or(1))?,
        "move" => picker.step(delta.unwrap_or(1)),
        "commit" => {
            let chosen = picker.finish_in_language(true, &state.language.lock().unwrap());
            if chosen.is_some() {
                activate_picker_role(&app, &picker.role, &picker.items)?;
            }
            result = match chosen {
                Some(Selection::Paste(_, text)) => serde_json::json!({"kind":"paste","text":text}),
                Some(Selection::Add) => {
                    state.pending_new.store(true, Ordering::SeqCst);
                    let _ = app.emit_to("main", "new-snippet", ());
                    serde_json::json!({"kind":"add"})
                }
                Some(Selection::Settings) => {
                    request_settings(&app, false);
                    serde_json::json!({"kind":"settings"})
                }
                None => serde_json::Value::Null,
            }
        }
        "cancel" => {
            picker.finish(false);
        }
        _ => return Err("Unknown preview action".into()),
    }
    app.emit_to("picker", "picker-state", picker.clone())
        .map_err(|e| e.to_string())?;
    Ok(result)
}
#[tauri::command]
fn get_shortcut(state: tauri::State<State>) -> shortcut::Shortcut {
    state.shortcut.lock().unwrap().clone()
}
#[tauri::command]
fn save_shortcut(
    app: tauri::AppHandle,
    shortcut: shortcut::Shortcut,
) -> Result<shortcut::Shortcut, String> {
    shortcut.validate()?;
    let state = app.state::<State>();
    let mut current = state.shortcut.lock().unwrap();
    let previous = current.clone();
    if !state.preview {
        platform::start(state.tx.clone(), shortcut.clone())?;
    }
    if let Err(error) = shortcut::save(&state.shortcut_path, &shortcut) {
        if !state.preview {
            if let Err(rollback) = platform::configure(previous) {
                set_status(&app, rollback);
            }
        }
        return Err(error);
    }
    *current = shortcut.clone();
    drop(current);
    let _ = app.emit("shortcut-changed", shortcut.clone());
    if !state.preview {
        set_status(&app, "已啟用".into());
    }
    Ok(shortcut)
}
#[tauri::command]
fn get_role(state: tauri::State<State>) -> String {
    state.role.lock().unwrap().clone()
}
#[tauri::command]
fn switch_role(
    app: tauri::AppHandle,
    role: String,
    defaults: Vec<Snippet>,
) -> Result<Vec<Snippet>, String> {
    let state = app.state::<State>();
    let mut current = state.role.lock().unwrap();
    if *current == role {
        return Ok(state.items.lock().unwrap().clone());
    }
    let path = state.files.lock().unwrap().path(&state.path, &role)?;
    let previous_path = state.files.lock().unwrap().path(&state.path, &current)?;
    let items = roles::load(&state.path, &role, &defaults)?;
    // Seed only a new role; the original personal file is never overwritten here.
    if !path.exists() {
        storage::save(&path, &items)?;
    }
    if !previous_path.exists() {
        storage::save(&previous_path, &state.items.lock().unwrap())?;
    }
    state.files.lock().unwrap().observe(&role);
    state.files.lock().unwrap().observe(&current);
    roles::remember(&state.path, &role)?;
    *state.items.lock().unwrap() = items.clone();
    *current = role.clone();
    drop(current);
    state.picker.lock().unwrap().finish(false);
    if let Some(window) = app.get_webview_window("picker") {
        let _ = window.hide();
    }
    let _ = app.emit("role-changed", role);
    Ok(items)
}
#[tauri::command]
fn get_snippets(state: tauri::State<State>) -> Vec<Snippet> {
    state.items.lock().unwrap().clone()
}
#[tauri::command]
fn save_snippets(
    items: Vec<Snippet>,
    expected: Option<storage::SavedSnapshot>,
    expected_role: Option<String>,
    state: tauri::State<State>,
) -> Result<(), String> {
    let role = state.role.lock().unwrap();
    if expected_role.as_ref().is_some_and(|id| id != &*role) {
        return Err("error.external_change".into());
    }
    let path = state.files.lock().unwrap().path(&state.path, &role)?;
    if let Some(snapshot) = expected.as_ref() {
        storage::check_snapshot(&path, snapshot)?;
    }
    storage::save(&path, &items)?;
    state.files.lock().unwrap().observe(&role);
    *state.items.lock().unwrap() = items;
    Ok(())
}
#[tauri::command]
fn storage_info(state: tauri::State<State>) -> serde_json::Value {
    let role = state.role.lock().unwrap();
    let path = roles::path(&state.path, &role).expect("validated role");
    serde_json::json!({"path": path.to_string_lossy(), "backup": path.with_extension("json.bak").to_string_lossy(), "exists": path.exists()})
}
#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .map_err(|e| e.to_string())?
        .set_text(text)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn open_data_folder(state: tauri::State<State>) -> Result<(), String> {
    let folder = state.path.parent().ok_or("找不到資料夾")?;
    std::fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer.exe")
        .arg(folder)
        .spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(folder).spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(folder).spawn();
    result.map(|_| ()).map_err(|e| e.to_string())
}
#[tauri::command]
fn reload_snippets(state: tauri::State<State>) -> Result<Vec<Snippet>, String> {
    let role = state.role.lock().unwrap();
    let path = roles::path(&state.path, &role)?;
    if !path.exists() {
        return Err("error.no_file".into());
    }
    let items = storage::load(&path, None)?;
    state.files.lock().unwrap().observe(&role);
    *state.items.lock().unwrap() = items.clone();
    Ok(items)
}
#[tauri::command]
fn picker_state(state: tauri::State<State>) -> Picker {
    state.picker.lock().unwrap().clone()
}
#[tauri::command]
fn consume_new_snippet(state: tauri::State<State>) -> bool {
    state.pending_new.swap(false, Ordering::SeqCst)
}
#[tauri::command]
fn consume_open_settings(state: tauri::State<State>) -> bool {
    state.pending_settings.swap(false, Ordering::SeqCst)
}
#[tauri::command]
fn native_status(state: tauri::State<State>) -> String {
    state.status.lock().unwrap().clone()
}
#[tauri::command]
fn restart_keyboard(app: tauri::AppHandle) {
    start_keyboard(&app);
}
#[tauri::command]
fn dismiss_manager_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    platform::cancel_selection();
    app.state::<State>().picker.lock().unwrap().finish(false);
    if let Some(window) = app.get_webview_window("picker") {
        window.hide().map_err(|e| e.to_string())?;
    }
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    app.hide().map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn hide_manager(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}
#[tauri::command]
fn window_action(window: tauri::WebviewWindow, action: String) -> Result<(), String> {
    if window.label() != "main" {
        return Err("只允許操作管理視窗".into());
    }
    match action.as_str() {
        "drag" => window.start_dragging(),
        "minimize" => window.minimize(),
        "maximize" => {
            if window.is_maximized().map_err(|e| e.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        _ => return Err("未知的視窗操作".into()),
    }
    .map_err(|e| e.to_string())
}
#[tauri::command]
fn configure_glass(app: tauri::AppHandle, dark: bool, transparency: u8) -> Result<(), String> {
    for label in ["main", "picker"] {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_theme(Some(if dark {
                    tauri::Theme::Dark
                } else {
                    tauri::Theme::Light
                }))
                .map_err(|e| e.to_string())?;
            #[cfg(target_os = "windows")]
            {
                // Windows 10 Blur and DWM shadows can leave a rectangular
                // backing outside the client mask. Keep the native edge clear.
                let _ = transparency;
                window.set_effects(None).map_err(|e| e.to_string())?;
                window.set_shadow(false).map_err(|e| e.to_string())?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                use tauri::window::{Color, Effect, EffectState, EffectsBuilder};
                let alpha = (85.0 + (100 - transparency.clamp(15, 85)) as f64 * 1.2) as u8;
                let color = if dark {
                    Color(32, 32, 32, alpha)
                } else {
                    Color(245, 245, 245, alpha)
                };
                let effects = EffectsBuilder::new()
                    .color(color)
                    .radius(18.0)
                    .state(EffectState::Active);
                #[cfg(target_os = "macos")]
                let effects =
                    effects
                        .effect(Effect::LiquidGlassClear)
                        .effect(if label == "picker" {
                            Effect::Popover
                        } else {
                            Effect::UnderWindowBackground
                        });
                window
                    .set_effects(effects.build())
                    .map_err(|e| e.to_string())?;
            }
            let maximized = window_shape::apply(&window)?;
            let _ = window.emit("window-layout", maximized);
        }
    }
    Ok(())
}
fn set_status(app: &tauri::AppHandle, message: String) {
    *app.state::<State>().status.lock().unwrap() = message;
    let _ = app.emit_to("main", "native-status", ());
}
fn start_keyboard(app: &tauri::AppHandle) {
    let state = app.state::<State>();
    if state.preview {
        return;
    }
    let shortcut = state.shortcut.lock().unwrap().clone();
    let result = platform::start(state.tx.clone(), shortcut);
    set_status(
        app,
        result.map(|_| "已啟用".to_string()).unwrap_or_else(|e| e),
    );
}
#[tauri::command]
fn request_quit(app: tauri::AppHandle) -> Result<(), String> {
    if !app.state::<State>().preview {
        manage(&app);
    }
    app.emit_to("main", "quit-requested", ())
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn confirm_quit(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the manager may confirm exit".into());
    }
    let app = window.app_handle();
    app.state::<State>()
        .quit_approved
        .store(true, Ordering::SeqCst);
    if !app.state::<State>().preview {
        app.exit(0);
    }
    Ok(())
}
#[tauri::command]
fn preview_quit_approved(state: tauri::State<State>) -> Result<bool, String> {
    if !state.preview {
        return Err("Preview mode required".into());
    }
    Ok(state.quit_approved.load(Ordering::SeqCst))
}
fn manage(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}
fn request_settings(app: &tauri::AppHandle, activate: bool) {
    app.state::<State>()
        .pending_settings
        .store(true, Ordering::SeqCst);
    if activate {
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            manage(&handle);
            let _ = handle.emit_to("main", "open-settings", ());
        });
    } else {
        let _ = app.emit_to("main", "open-settings", ());
    }
}
// The manager is dismiss-only. An external target must remain unchanged.
fn picker_target(original: usize, from_manager: bool, foreground: Option<usize>) -> Option<usize> {
    if from_manager {
        None
    } else {
        foreground.filter(|target| *target == original)
    }
}
fn prepare_shortcut_target(app: &tauri::AppHandle, original: usize) -> Option<usize> {
    let from_manager = platform::is_app_target(original);
    let handle = app.clone();
    let (tx, rx) = mpsc::channel();
    app.run_on_main_thread(move || {
        let result = if let Some(window) = handle.get_webview_window("main") {
            if window.is_visible().unwrap_or(false) {
                window.hide()
            } else {
                Ok(())
            }
        } else {
            Ok(())
        };
        #[cfg(target_os = "macos")]
        let result = result.and_then(|_| if from_manager { handle.hide() } else { Ok(()) });
        let _ = tx.send(result.is_ok());
    })
    .ok()?;
    if !rx.recv_timeout(std::time::Duration::from_secs(2)).ok()? {
        return None;
    }
    picker_target(original, from_manager, platform::foreground_target())
}
fn change_picker_role(state: &State, picker: &mut Picker, delta: i32) -> Result<(), String> {
    if !picker.active {
        return Ok(());
    }
    let id = roles::next_id(&picker.role, delta).to_string();
    state.files.lock().unwrap().path(&state.path, &id)?;
    let current = state.role.lock().unwrap();
    let items = if *current == id {
        state.items.lock().unwrap().clone()
    } else {
        let defaults = roles::defaults(&id, &state.language.lock().unwrap())?;
        roles::load(&state.path, &id, &defaults)?
    };
    picker.change_role(id, items);
    Ok(())
}
fn activate_picker_role(app: &tauri::AppHandle, id: &str, items: &[Snippet]) -> Result<(), String> {
    let state = app.state::<State>();
    let mut current = state.role.lock().unwrap();
    if *current == id {
        return Ok(());
    }
    let path = state.files.lock().unwrap().path(&state.path, id)?;
    let previous = state.files.lock().unwrap().path(&state.path, &current)?;
    if !path.exists() {
        storage::save(&path, items)?;
    }
    if !previous.exists() {
        storage::save(&previous, &state.items.lock().unwrap())?;
    }
    state.files.lock().unwrap().observe(id);
    state.files.lock().unwrap().observe(&current);
    roles::remember(&state.path, id)?;
    *state.items.lock().unwrap() = items.to_vec();
    *current = id.to_string();
    drop(current);
    let _ = app.emit("active-role-changed", id);
    Ok(())
}
fn handle_action(app: &tauri::AppHandle, action: Action) {
    diagnostic(&format!("action: {action:?}"));
    let state = app.state::<State>();
    match action {
        Action::Dismiss => {
            let _ = dismiss_manager_shortcut(app.clone());
        }
        Action::Begin(target) => {
            let Some(target) = prepare_shortcut_target(app, target) else {
                state.picker.lock().unwrap().finish(false);
                return;
            };
            let items = state.items.lock().unwrap().clone();
            {
                let mut picker = state.picker.lock().unwrap();
                picker.begin(items, target);
                picker.role = state.role.lock().unwrap().clone();
                let _ = app.emit_to("picker", "picker-state", picker.clone());
            }
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || {
                if let Some(w) = handle.get_webview_window("picker") {
                    // Keep three complete snippet rows above the fixed actions.
                    // On a smaller work area, retain scrolling instead of clipping the window.
                    if let Ok(Some(monitor)) = w.current_monitor() {
                        let scale = monitor.scale_factor();
                        let area = monitor.work_area();
                        let width = 580.0_f64.min((area.size.width as f64 / scale - 32.0).max(1.0));
                        let height =
                            480.0_f64.min((area.size.height as f64 / scale - 32.0).max(1.0));
                        let _ = w.set_size(tauri::LogicalSize::new(width, height));
                    }
                    #[cfg(target_os = "macos")]
                    platform::unhide_without_activation();
                    let _ = w.center();
                    let _ = w.show();
                    #[cfg(windows)]
                    window_regression::record("alt-h-open", &w);
                }
            });
        }
        Action::Role(delta) => {
            let mut picker = state.picker.lock().unwrap();
            if change_picker_role(&state, &mut picker, delta).is_ok() {
                let _ = app.emit_to("picker", "picker-state", picker.clone());
            }
        }
        Action::Move(delta) => {
            let mut picker = state.picker.lock().unwrap();
            picker.step(delta);
            let _ = app.emit_to("picker", "picker-state", picker.clone());
        }
        Action::Commit | Action::Cancel => {
            let paste = matches!(action, Action::Commit);
            let (chosen, role, items) = {
                let mut picker = state.picker.lock().unwrap();
                (
                    picker.finish_in_language(paste, &state.language.lock().unwrap()),
                    picker.role.clone(),
                    picker.items.clone(),
                )
            };
            let chosen = if chosen.is_some() && activate_picker_role(app, &role, &items).is_err() {
                None
            } else {
                chosen
            };
            let handle = app.clone();
            let (tx, rx) = mpsc::channel();
            let _ = app.run_on_main_thread(move || {
                if let Some(w) = handle.get_webview_window("picker") {
                    let _ = w.hide();
                }
                let _ = tx.send(());
            });
            if let Some(Selection::Paste(target, text)) = chosen {
                if rx.recv_timeout(std::time::Duration::from_secs(2)).is_ok() {
                    if let Err(error) = platform::paste(target, &text) {
                        diagnostic(&format!("paste error: {error}"));
                        set_status(app, error);
                    } else {
                        diagnostic("paste input sent");
                    }
                }
            } else if chosen == Some(Selection::Settings) {
                request_settings(app, true);
            } else if chosen == Some(Selection::Add) {
                state.pending_new.store(true, Ordering::SeqCst);
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || {
                    manage(&handle);
                    let _ = handle.emit_to("main", "new-snippet", ());
                });
            }
        }
        Action::Error(error) => set_status(app, error),
    }
}
fn diagnostic(message: &str) {
    use std::io::Write;
    static ENABLED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    if *ENABLED.get_or_init(|| std::env::args().any(|arg| arg == "--integration-test")) {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(std::env::temp_dir().join("quicksay-integration.log"))
        {
            let _ = writeln!(file, "{message}");
        }
    }
}
fn main() {
    let preview = std::env::args().any(|arg| arg == "--design-preview");
    let builder = tauri::Builder::default();
    let builder = if preview {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, _, _| manage(app)))
    };
    builder
        .invoke_handler(tauri::generate_handler![
            request_quit,
            confirm_quit,
            preview_quit_approved,
            get_snippets,
            get_role,
            switch_role,
            get_shortcut,
            save_shortcut,
            save_snippets,
            storage_info,
            copy_text,
            open_data_folder,
            reload_snippets,
            set_ui_language,
            preview_picker,
            picker_state,
            native_status,
            restart_keyboard,
            hide_manager,
            dismiss_manager_shortcut,
            window_action,
            configure_glass,
            consume_new_snippet,
            consume_open_settings
        ])
        .setup(move |app| {
            let integration = std::env::args().any(|arg| arg == "--integration-test");
            let source_path = app.path().app_config_dir()?.join("snippets.json");
            let path = if preview {
                std::env::temp_dir().join(format!(
                    "quicksay-design-preview-{}/snippets.json",
                    std::process::id()
                ))
            } else if integration {
                std::env::temp_dir().join("quicksay-integration/snippets.json")
            } else {
                app.path().app_config_dir()?.join("snippets.json")
            };
            let old =
                std::env::var_os("APPDATA").map(|p| PathBuf::from(p).join("QuickSay/settings.xml"));
            let initial_role = roles::active(if preview { &source_path } else { &path })
                .map_err(std::io::Error::other)?;
            let role_path = roles::path(if preview { &source_path } else { &path }, &initial_role)
                .map_err(std::io::Error::other)?;
            if initial_role != "personal" && !role_path.exists() {
                return Err(std::io::Error::other("error.no_file").into());
            }
            let items = if integration {
                storage::defaults().into_iter().take(2).collect()
            } else {
                storage::load(
                    &role_path,
                    if initial_role == "personal" {
                        old.as_deref()
                    } else {
                        None
                    },
                )
                .map_err(std::io::Error::other)?
            };
            let shortcut_path = path.with_file_name("shortcut.json");
            let loaded_shortcut = shortcut::load(&shortcut_path);
            let shortcut_error = loaded_shortcut.as_ref().err().cloned();
            let initial_shortcut = loaded_shortcut.unwrap_or_default();
            let (tx, rx) = mpsc::channel();
            let files = roles::KnownFiles::new(&path);
            app.manage(State {
                files: Mutex::new(files),
                items: Mutex::new(items),
                role: Mutex::new(initial_role),
                language: Mutex::new("en".into()),
                shortcut: Mutex::new(initial_shortcut),
                shortcut_path,
                preview,
                picker: Mutex::new(Picker::default()),
                status: Mutex::new(String::new()),
                path,
                tx,
                quit_approved: AtomicBool::new(false),
                pending_new: AtomicBool::new(std::env::args().any(|arg| arg == "--new-snippet")),
                pending_settings: AtomicBool::new(false),
            });
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Ok(action) = rx.recv() {
                    handle_action(&handle, action);
                }
            });
            let manage_item = tauri::menu::MenuItem::with_id(
                app,
                "manage",
                "Manage snippets",
                true,
                None::<&str>,
            )?;
            let quit_item = tauri::menu::MenuItem::with_id(
                app,
                "quit",
                "Quit before-you-do",
                true,
                None::<&str>,
            )?;
            let menu = tauri::menu::Menu::with_items(app, &[&manage_item, &quit_item])?;
            app.manage(UiMenu {
                manage: manage_item,
                quit: quit_item,
            });
            let icon = tauri::image::Image::new_owned(
                include_bytes!("../icons/tray.rgba").to_vec(),
                32,
                32,
            );
            tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .tooltip("before-you-do")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "manage" => manage(app),
                    "quit" => {
                        let _ = request_quit(app.clone());
                    }
                    _ => {}
                })
                .build(app)?;
            let main = app.get_webview_window("main").unwrap();
            // Prefer a tall library/editor, but stay inside the monitor's usable
            // work area (taskbar excluded), including scaled laptop displays.
            if let Some(monitor) = main.current_monitor()? {
                let scale = monitor.scale_factor();
                let area = monitor.work_area();
                let width = 940.0_f64.min((area.size.width as f64 / scale - 32.0).max(1.0));
                let height = 820.0_f64.min((area.size.height as f64 / scale - 32.0).max(1.0));
                main.set_min_size(Some(tauri::LogicalSize::new(
                    780.0_f64.min(width),
                    680.0_f64.min(height),
                )))?;
                main.set_size(tauri::LogicalSize::new(width, height))?;
                main.set_position(tauri::PhysicalPosition::new(
                    area.position.x
                        + ((area.size.width as f64 - width * scale) / 2.0).round() as i32,
                    area.position.y
                        + ((area.size.height as f64 - height * scale) / 2.0).round() as i32,
                ))?;
            }
            let app_handle = app.handle().clone();
            main.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = app_handle.emit_to("main", "save-before-hide", ());
                }
            });
            if let Some(picker) = app.get_webview_window("picker") {
                picker.set_ignore_cursor_events(true)?;
            }
            for label in ["main", "picker"] {
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window_shape::apply(&window);
                    let handle = window.clone();
                    window.on_window_event(move |event| {
                        if matches!(
                            event,
                            tauri::WindowEvent::Resized(_)
                                | tauri::WindowEvent::ScaleFactorChanged { .. }
                        ) {
                            if let Ok(maximized) = window_shape::apply(&handle) {
                                let _ = handle.emit("window-layout", maximized);
                            }
                        }
                    });
                }
            }
            #[cfg(windows)]
            window_regression::start(app.handle());
            #[cfg(windows)]
            if std::env::args().any(|arg| arg == "--visual-audit") {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    let h = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        let results: Vec<_> = ["main", "picker"]
                            .iter()
                            .filter_map(|label| h.get_webview_window(label))
                            .map(|w| window_shape::inspect(&w))
                            .collect();
                        if let Ok(exe) = std::env::current_exe() {
                            let _ = std::fs::write(
                                exe.with_extension("shape-audit.json"),
                                serde_json::to_string_pretty(&results).unwrap(),
                            );
                        }
                    });
                });
            }
            if preview {
                set_status(
                    app.handle(),
                    "外觀預覽 · 快捷鍵由原視窗提供；此預覽只儲存暫存資料。".into(),
                );
            } else {
                start_keyboard(app.handle());
                if let Some(error) = shortcut_error {
                    set_status(app.handle(), error);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("無法啟動 before-you-do")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<State>().quit_approved.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = request_quit(app.clone());
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manager_shortcut_uses_only_a_valid_external_target() {
        assert_eq!(picker_target(10, true, Some(20)), None);
        assert_eq!(picker_target(10, true, None), None);
        assert_eq!(picker_target(20, false, Some(20)), Some(20));
        assert_eq!(picker_target(20, false, Some(30)), None);
        assert_eq!(picker_target(20, false, None), None);
    }
    #[test]
    fn role_navigation_resets_selection_and_preserves_target() {
        assert_eq!(roles::next_id("personal", -1), "project");
        assert_eq!(roles::next_id("project", 1), "personal");
        let mut picker = Picker::default();
        picker.begin(storage::defaults(), 123);
        picker.step(-1);
        let items = roles::defaults("designer", "zh-TW").unwrap();
        picker.change_role("designer".into(), items.clone());
        assert_eq!(picker.selected, 0);
        assert_eq!(picker.target, 123);
        assert_eq!(picker.role, "designer");
        assert_eq!(
            picker.finish(true),
            Some(Selection::Paste(123, items[0].text.clone()))
        );
        picker.change_role("writer".into(), storage::defaults());
        assert_eq!(picker.role, "designer");
    }
    #[test]
    fn selection_wraps_and_commits_once() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(1);
        assert_eq!(p.selected, 1);
        let expected = p.items[1].text.clone();
        assert_eq!(p.finish(true), Some(Selection::Paste(123, expected)));
        assert_eq!(p.finish(true), None);
    }
    #[test]
    fn cancel_never_pastes() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(1);
        assert_eq!(p.finish(false), None);
        assert_eq!(p.finish(true), None);
    }
    #[test]
    fn localized_commit_pastes_translated_builtin_without_changing_snapshot() {
        let original = roles::defaults("personal", "zh-TW").unwrap();
        let mut picker = Picker::default();
        picker.begin(original.clone(), 123);
        let english = roles::defaults("personal", "en").unwrap();
        assert_eq!(
            picker.finish_in_language(true, "en"),
            Some(Selection::Paste(123, english[0].text.clone()))
        );
        assert_eq!(picker.items, original);
        picker.begin(storage::defaults(), 123);
        assert_eq!(
            picker.finish_in_language(true, "en"),
            Some(Selection::Paste(123, english[0].text.clone()))
        );
        let mut added = storage::defaults();
        added[0].custom = true;
        picker.begin(added.clone(), 123);
        assert_eq!(
            picker.finish_in_language(true, "en"),
            Some(Selection::Paste(123, added[0].text.clone()))
        );
        let mut custom = original.clone();
        custom[0].scenario = Some(String::new());
        picker.begin(custom.clone(), 123);
        assert_eq!(
            picker.finish_in_language(true, "en"),
            Some(Selection::Paste(123, custom[0].text.clone()))
        );
        picker.begin(original, 123);
        assert_eq!(picker.finish_in_language(false, "en"), None);
    }
    #[test]
    fn selection_snapshot_survives_edits() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 5);
        let mut changed = storage::defaults();
        changed.clear();
        assert_eq!(p.items.len(), storage::defaults().len());
        assert!(p.finish(true).is_some());
    }
    #[test]
    fn last_row_opens_add_without_pasting() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(-2);
        assert_eq!(p.selected, p.items.len());
        assert_eq!(p.finish(true), Some(Selection::Add));
        assert_eq!(p.finish(true), None);
    }
    #[test]
    fn add_row_wraps_and_can_be_cancelled() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(p.items.len() as i32);
        assert_eq!(p.selected, p.items.len());
        p.step(1);
        assert_eq!(p.selected, p.items.len() + 1);
        p.step(1);
        assert_eq!(p.selected, 0);
        p.step(-1);
        assert_eq!(p.finish(false), None);
    }
    #[test]
    fn settings_row_wraps_commits_once_and_can_be_cancelled() {
        let mut p = Picker::default();
        p.begin(storage::defaults(), 123);
        p.step(-1);
        assert_eq!(p.selected, p.items.len() + 1);
        assert_eq!(p.finish(true), Some(Selection::Settings));
        assert_eq!(p.finish(true), None);
        p.begin(storage::defaults(), 123);
        p.step(-1);
        assert_eq!(p.finish(false), None);
        assert_eq!(p.finish(true), None);
    }
}
