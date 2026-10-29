//! Independent silent Windows region recording. FFmpeg runs as a child, never via a shell.
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Format {
    Video,
    Gif,
}
#[derive(Clone, Default, Serialize)]
pub struct Status {
    pub phase: String,
    pub format: Option<Format>,
    pub error: Option<String>,
    pub recovery: Option<String>,
    pub elapsed_ms: u64,
    pub completion_sound_played: bool,
}
#[derive(Default)]
pub struct Recorder {
    status: Mutex<Status>,
    stop: AtomicBool,
    installing: AtomicBool,
    pause: AtomicBool,
    discard: AtomicBool,
    clock: Mutex<RecordingClock>,
}
pub fn runtime_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("LOCALAPPDATA").map(|p| {
            PathBuf::from(p)
                .join("before-you-do/recording-runtime/ffmpeg-8.1-0448c3f3/bin/ffmpeg.exe")
        })
    }
    #[cfg(not(windows))]
    {
        None
    }
}
impl Recorder {
    pub fn active(&self) -> bool {
        matches!(
            self.status.lock().unwrap().phase.as_str(),
            "recording" | "pausing" | "paused" | "finalizing"
        )
    }
    pub fn cancel(&self) {
        self.discard.store(true, Ordering::SeqCst);
        self.stop();
    }
    pub fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}
fn emit(app: &tauri::AppHandle) {
    let status = snapshot(&app.state::<Recorder>());
    if let Some(tray) = app.tray_by_id("main-tray") {
        let mut pixels = include_bytes!("../icons/tray.rgba").to_vec();
        if matches!(
            status.phase.as_str(),
            "recording" | "pausing" | "paused" | "finalizing"
        ) {
            for y in 0..14 {
                for x in 18..32 {
                    if (x as i32 - 25).pow(2) + (y as i32 - 7).pow(2) <= 36 {
                        let i = (y * 32 + x) * 4;
                        pixels[i..i + 4].copy_from_slice(&[239, 68, 68, 255]);
                    }
                }
            }
        }
        let _ = tray.set_icon(Some(tauri::image::Image::new_owned(pixels, 32, 32)));
    }
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_tooltip(Some(if status.phase == "recording" {
            "before-you-do • RECORDING — use the same recording shortcut to stop"
        } else {
            "before-you-do"
        }));
    }
    let _ = app.emit_to("main", "recording-state", status.clone());
    let _ = app.emit_to("recording-controls", "recording-state", status);
}
#[derive(Serialize)]
pub struct View {
    pub supported: bool,
    pub runtime_ready: bool,
    pub installing: bool,
    pub status: Status,
}
#[tauri::command]
pub fn recording_state(
    w: tauri::WebviewWindow,
    state: tauri::State<Recorder>,
) -> Result<View, String> {
    if !["main", "recording-controls"].contains(&w.label()) {
        return Err("Manager only".into());
    }
    Ok(View {
        supported: cfg!(windows),
        runtime_ready: runtime_path().is_some_and(|p| p.is_file()),
        installing: state.installing.load(Ordering::SeqCst),
        status: snapshot(&state),
    })
}
#[tauri::command]
pub fn recording_stop(
    w: tauri::WebviewWindow,
    state: tauri::State<Recorder>,
) -> Result<(), String> {
    if w.label() != "main" {
        return Err("Manager only".into());
    }
    state.stop();
    Ok(())
}
// Explicit isolated native test entry; never available in a normal running instance.
#[tauri::command]
pub fn preview_recording(
    w: tauri::WebviewWindow,
    app: tauri::AppHandle,
    format: Format,
) -> Result<(), String> {
    if w.label() != "main"
        || !app.state::<crate::State>().preview
        || !std::env::args().any(|a| a == "--recording-test")
    {
        return Err("Isolated recording test mode required".into());
    }
    let frame = crate::capture::capture("fullscreen", 0)?;
    let rect = if std::env::args().any(|a| a == "--recording-ui-test") {
        [frame.x + 180, frame.y + 140, 360, 240]
    } else {
        [frame.x, frame.y, 160, 120]
    };
    start(app, format, rect)
}
#[tauri::command]
pub async fn recording_install(
    w: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if w.label() != "main" {
        return Err("Manager only".into());
    }
    let state = app.state::<Recorder>();
    if !cfg!(windows) {
        return Err("Recording currently supports Windows only".into());
    }
    if state.active() || state.installing.swap(true, Ordering::SeqCst) {
        return Err("Recording component is busy".into());
    }
    let result = tauri::async_runtime::spawn_blocking(|| {
        let mut command = std::process::Command::new("powershell.exe");
        command.args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            include_str!("../../scripts/install-recording-runtime.ps1"),
        ]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let output = command.output().map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr)
                .chars()
                .take(1500)
                .collect());
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|v| v);
    state.installing.store(false, Ordering::SeqCst);
    emit(&app);
    result
}
pub fn validate_rect(rect: [i32; 4]) -> Result<(), String> {
    let [x, y, w, h] = rect;
    if w < 2
        || h < 2
        || w > 16384
        || h > 16384
        || (w as u64) * (h as u64) > 64_000_000
        || x.checked_add(w).is_none()
        || y.checked_add(h).is_none()
    {
        return Err("Recording region must be at least 2×2 and within capture limits".into());
    }
    Ok(())
}
pub fn encoder_args(format: &Format, rect: [i32; 4], output: &Path) -> Result<Vec<String>, String> {
    validate_rect(rect)?;
    let [x, y, w, h] = rect;
    let mut args = vec![
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-y".into(),
        "-f".into(),
        "gdigrab".into(),
        "-framerate".into(),
        if *format == Format::Gif { "10" } else { "15" }.into(),
        "-draw_mouse".into(),
        "1".into(),
        "-offset_x".into(),
        x.to_string(),
        "-offset_y".into(),
        y.to_string(),
        "-video_size".into(),
        format!("{w}x{h}"),
        "-i".into(),
        "desktop".into(),
        "-an".into(),
        "-t".into(),
        "120".into(),
        "-fs".into(),
        (24 * 1024 * 1024).to_string(),
    ];
    if *format == Format::Gif {
        args.extend(["-vf","fps=10,scale='min(960,iw)':-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=single[p];[b][p]paletteuse=new=1:dither=bayer","-loop","0"].map(String::from));
    } else {
        args.extend(
            [
                "-c:v",
                "libvpx",
                "-deadline",
                "realtime",
                "-cpu-used",
                "6",
                "-b:v",
                "1600k",
                "-crf",
                "12",
                "-pix_fmt",
                "yuv420p",
                "-vf",
                "pad=ceil(iw/2)*2:ceil(ih/2)*2",
                "-f",
                "webm",
            ]
            .map(String::from),
        );
    }
    args.push(output.to_string_lossy().into_owned());
    Ok(args)
}
pub fn start(app: tauri::AppHandle, format: Format, rect: [i32; 4]) -> Result<(), String> {
    validate_rect(rect)?;
    let executable = runtime_path()
        .filter(|p| p.is_file())
        .ok_or("Install the recording component from Prompt workspace first")?;
    let state = app.state::<Recorder>();
    {
        let mut status = state.status.lock().unwrap();
        if state.installing.load(Ordering::SeqCst) {
            return Err("Recording component installation is still in progress".into());
        }
        if matches!(
            status.phase.as_str(),
            "recording" | "pausing" | "paused" | "finalizing"
        ) {
            return Err("Recording already in progress".into());
        }
        *status = Status {
            phase: "recording".into(),
            format: Some(format.clone()),
            ..Default::default()
        };
    }
    state.stop.store(false, Ordering::SeqCst);
    state.pause.store(false, Ordering::SeqCst);
    state.discard.store(false, Ordering::SeqCst);
    *state.clock.lock().unwrap() = RecordingClock::default();
    emit(&app);
    std::thread::spawn(move || {
        let result = crate::recording_overlay::show(&app, rect)
            .map_err(|e| (e, None))
            .and_then(|_| run(&app, &executable, &format, rect));
        crate::recording_overlay::hide(&app);
        let elapsed = app.state::<Recorder>().clock.lock().unwrap().elapsed_ms();
        let state = app.state::<Recorder>();
        match result {
            Ok(()) => {
                *state.status.lock().unwrap() = Status {
                    phase: if state.discard.load(Ordering::SeqCst) {
                        "cancelled"
                    } else {
                        "saved"
                    }
                    .into(),
                    elapsed_ms: elapsed,
                    completion_sound_played: !state.discard.load(Ordering::SeqCst)
                        && completion_sound(),
                    format: Some(format),
                    ..Default::default()
                }
            }
            Err((error, recovery)) => {
                *state.status.lock().unwrap() = Status {
                    phase: "error".into(),
                    format: Some(format),
                    error: Some(error),
                    recovery,
                    elapsed_ms: elapsed,
                    ..Default::default()
                }
            }
        }
        emit(&app);
        let _ = app.emit_to("main", "materials-updated", ());
    });
    Ok(())
}
#[derive(Default)]
struct RecordingClock {
    accumulated: Duration,
    running: Option<Instant>,
}
impl RecordingClock {
    fn resume(&mut self) {
        if self.running.is_none() {
            self.running = Some(Instant::now());
        }
    }
    fn pause(&mut self) {
        if let Some(t) = self.running.take() {
            self.accumulated += t.elapsed();
        }
    }
    fn elapsed_ms(&self) -> u64 {
        (self.accumulated + self.running.map(|t| t.elapsed()).unwrap_or_default())
            .as_millis()
            .min(u64::MAX as u128) as u64
    }
}
fn snapshot(state: &Recorder) -> Status {
    let mut status = state.status.lock().unwrap().clone();
    status.elapsed_ms = state.clock.lock().unwrap().elapsed_ms();
    status
}
#[tauri::command]
pub fn recording_control(
    w: tauri::WebviewWindow,
    state: tauri::State<Recorder>,
    app: tauri::AppHandle,
    action: String,
) -> Result<(), String> {
    if !["main", "recording-controls"].contains(&w.label()) {
        return Err("Recording controls only".into());
    }
    let phase = state.status.lock().unwrap().phase.clone();
    match (action.as_str(), phase.as_str()) {
        ("stop", "recording" | "paused" | "pausing") => state.stop(),
        ("cancel", "recording" | "paused" | "pausing") => state.cancel(),
        ("pause", "recording") => {
            state.pause.store(true, Ordering::SeqCst);
            state.status.lock().unwrap().phase = "pausing".into();
            emit(&app);
        }
        ("resume", "paused") => {
            state.pause.store(false, Ordering::SeqCst);
        }
        _ => return Err("Recording action is not available in the current state".into()),
    }
    Ok(())
}
fn completion_sound() -> bool {
    if std::env::args().any(|a| a == "--recording-test")
        && !std::env::args().any(|a| a == "--recording-sound-test")
    {
        return false;
    }
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::Media::Audio::*;
        let wave = include_bytes!("../assets/recording-complete.wav");
        return PlaySoundW(
            wave.as_ptr() as *const u16,
            std::ptr::null_mut(),
            SND_MEMORY | SND_ASYNC | SND_NODEFAULT,
        ) != 0;
    }
    #[cfg(not(windows))]
    false
}
fn command(executable: &Path, args: &[String]) -> std::process::Command {
    let mut cmd = std::process::Command::new(executable);
    cmd.args(args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd
}
fn drain(stderr: std::process::ChildStderr) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        use std::io::Read;
        let mut bytes = Vec::new();
        let mut reader = stderr;
        let mut buf = [0u8; 1024];
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 {
                break;
            }
            if bytes.len() < 4096 {
                bytes.extend_from_slice(&buf[..n.min(4096 - bytes.len())]);
            }
        }
        String::from_utf8_lossy(&bytes).into_owned()
    })
}
fn finalize(executable: &Path, args: &[String]) -> Result<(), String> {
    let mut cmd = command(executable, args);
    cmd.stdin(std::process::Stdio::null());
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    let _job = ChildJob::attach(&child).map_err(|e| {
        let _ = child.kill();
        let _ = child.wait();
        e
    })?;
    let logs = drain(child.stderr.take().unwrap());
    let start = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            let log = logs.join().unwrap_or_default();
            return if status.success() {
                Ok(())
            } else {
                Err(format!("Recording finalization failed: {log}"))
            };
        }
        if start.elapsed() > Duration::from_secs(120) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Recording finalization timed out; segments retained".into());
        }
        std::thread::park_timeout(Duration::from_millis(40));
    }
}
fn run(
    app: &tauri::AppHandle,
    executable: &Path,
    format: &Format,
    rect: [i32; 4],
) -> Result<(), (String, Option<String>)> {
    use std::io::Write;
    let root = app
        .state::<crate::materials::Materials>()
        .recording_directory()
        .map_err(|e| (e, None))?;
    let key = format!(
        "recording-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let dir = root.join(&key);
    std::fs::create_dir(&dir).map_err(|e| (e.to_string(), None))?;
    let recovery = Some(dir.to_string_lossy().to_string());
    let state = app.state::<Recorder>();
    let mut segments = Vec::new();
    let mut bytes = 0u64;
    while !state.stop.load(Ordering::SeqCst) {
        while state.pause.load(Ordering::SeqCst) && !state.stop.load(Ordering::SeqCst) {
            std::thread::park_timeout(Duration::from_millis(40));
        }
        if state.stop.load(Ordering::SeqCst) {
            break;
        }
        if segments.len() >= 100 {
            state.stop();
            break;
        }
        let path = dir.join(format!("segment-{}.webm", segments.len()));
        let args = encoder_args(&Format::Video, rect, &path).map_err(|e| (e, recovery.clone()))?;
        let mut child = command(executable, &args)
            .spawn()
            .map_err(|e| (e.to_string(), recovery.clone()))?;
        #[cfg(windows)]
        let _job = ChildJob::attach(&child).map_err(|e| {
            let _ = child.kill();
            let _ = child.wait();
            (e, recovery.clone())
        })?;
        let logs = drain(child.stderr.take().unwrap());
        state.clock.lock().unwrap().resume();
        state.status.lock().unwrap().phase = "recording".into();
        crate::recording_overlay::paused(false);
        emit(app);
        let mut closing = None;
        let exit = loop {
            match child.try_wait() {
                Ok(Some(exit)) => break exit,
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err((e.to_string(), recovery));
                }
                _ => {}
            }
            if closing.is_none()
                && (state.stop.load(Ordering::SeqCst)
                    || state.pause.load(Ordering::SeqCst)
                    || state.clock.lock().unwrap().elapsed_ms() >= 120_000)
            {
                if state.clock.lock().unwrap().elapsed_ms() >= 120_000 {
                    state.stop();
                }
                state.clock.lock().unwrap().pause();
                state.status.lock().unwrap().phase = if state.stop.load(Ordering::SeqCst) {
                    "finalizing"
                } else {
                    "pausing"
                }
                .into();
                emit(app);
                if let Some(mut stdin) = child.stdin.take() {
                    let _ = stdin.write_all(b"q\n");
                }
                closing = Some(Instant::now());
            }
            if closing.is_some_and(|t| t.elapsed() > Duration::from_secs(15)) {
                let _ = child.kill();
                let _ = child.wait();
                return Err(("Recorder did not stop; segments retained".into(), recovery));
            }
            std::thread::park_timeout(Duration::from_millis(40));
        };
        state.clock.lock().unwrap().pause();
        let log = logs.join().unwrap_or_default();
        if !exit.success() {
            return Err((format!("Recording failed: {log}"), recovery));
        }
        bytes += std::fs::metadata(&path)
            .map_err(|e| (e.to_string(), recovery.clone()))?
            .len();
        segments.push(path);
        if bytes >= 24 * 1024 * 1024 || closing.is_none() {
            state.stop();
        }
        if state.pause.load(Ordering::SeqCst) && !state.stop.load(Ordering::SeqCst) {
            state.status.lock().unwrap().phase = "paused".into();
            crate::recording_overlay::paused(true);
            emit(app);
        }
    }
    if state.discard.load(Ordering::SeqCst) {
        for p in segments {
            let _ = std::fs::remove_file(p);
        }
        let _ = std::fs::remove_dir(&dir);
        return Ok(());
    }
    if segments.is_empty() {
        return Err(("No recorded frames; nothing was saved".into(), recovery));
    }
    state.status.lock().unwrap().phase = "finalizing".into();
    emit(app);
    let list = dir.join("segments.txt");
    std::fs::write(
        &list,
        (0..segments.len())
            .map(|i| format!("file 'segment-{i}.webm'\n"))
            .collect::<String>(),
    )
    .map_err(|e| (e.to_string(), recovery.clone()))?;
    let name = format!(
        "{key}.{}",
        if *format == Format::Gif {
            "gif"
        } else {
            "webm"
        }
    );
    let output = dir.join(&name);
    let mut args = vec![
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-y".into(),
        "-f".into(),
        "concat".into(),
        "-safe".into(),
        "1".into(),
        "-i".into(),
        list.to_string_lossy().into_owned(),
        "-an".into(),
    ];
    if *format == Format::Video {
        args.extend(["-c:v", "copy"].map(String::from));
    } else {
        args.extend(["-vf","fps=10,scale='min(960,iw)':-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=single[p];[b][p]paletteuse=new=1:dither=bayer","-loop","0"].map(String::from));
    }
    args.push(output.to_string_lossy().into_owned());
    finalize(executable, &args).map_err(|e| (e, recovery.clone()))?;
    let size = std::fs::metadata(&output)
        .map_err(|e| (e.to_string(), recovery.clone()))?
        .len();
    if size == 0 || size > 25 * 1024 * 1024 {
        return Err((
            "Recording is empty or exceeds 25 MB; segments retained".into(),
            recovery,
        ));
    }
    let content = std::fs::read(&output).map_err(|e| (e.to_string(), recovery.clone()))?;
    app.state::<crate::materials::Materials>()
        .add_recording(name, content, *format == Format::Gif)
        .map_err(|e| (e, recovery.clone()))?;
    for path in segments.into_iter().chain([list, output]) {
        let _ = std::fs::remove_file(path);
    }
    let _ = std::fs::remove_dir(dir);
    Ok(())
}
// Closing the app also closes this Job handle, so a crashed app cannot leave a recorder running.
#[cfg(windows)]
struct ChildJob(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl ChildJob {
    fn attach(child: &std::process::Child) -> Result<Self, String> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err("Cannot create recording process job".into());
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of_val(&info) as u32,
            ) == 0
                || AssignProcessToJobObject(job, child.as_raw_handle()) == 0
            {
                CloseHandle(job);
                return Err("Cannot contain recording child process".into());
            }
            Ok(Self(job))
        }
    }
}
#[cfg(windows)]
impl Drop for ChildJob {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paused_clock_does_not_accumulate_wall_time() {
        let mut clock = RecordingClock {
            accumulated: Duration::from_millis(500),
            running: Some(Instant::now() - Duration::from_secs(2)),
        };
        clock.pause();
        let paused = clock.elapsed_ms();
        assert!(paused >= 2500);
        assert_eq!(clock.elapsed_ms(), paused);
        assert!(clock.running.is_none());
        clock.resume();
        assert!(clock.running.is_some());
        assert!(clock.elapsed_ms() >= paused);
    }
    #[test]
    fn completion_wave_is_real_pcm_audio() {
        let wav = include_bytes!("../assets/recording-complete.wav");
        assert_eq!(&wav[..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(u16::from_le_bytes([wav[20], wav[21]]), 1);
        assert_eq!(u32::from_le_bytes(wav[24..28].try_into().unwrap()), 22050);
        assert!(wav[44..]
            .chunks_exact(2)
            .map(|s| i16::from_le_bytes([s[0], s[1]]))
            .any(|v| v.abs() > 2000));
    }
    #[test]
    fn native_arguments_are_bounded_and_shell_free() {
        let args = encoder_args(
            &Format::Video,
            [-1920, 0, 641, 479],
            Path::new("space ; &.webm"),
        )
        .unwrap();
        assert_eq!(args.last().unwrap(), "space ; &.webm");
        assert!(args.contains(&"-1920".into()));
        assert!(args.contains(&"libvpx".into()));
        assert!(args.contains(&"-an".into()));
        assert!(!args.contains(&"-nostdin".into()));
        assert!(encoder_args(&Format::Gif, [0, 0, 0, 10], Path::new("x.gif")).is_err());
        assert!(validate_rect([i32::MAX, 0, 2, 2]).is_err());
    }
    #[test]
    fn gif_uses_palette_and_no_video_encoder() {
        let a = encoder_args(&Format::Gif, [0, 0, 100, 100], Path::new("x.gif")).unwrap();
        assert!(a.iter().any(|v| v.contains("palettegen")));
        assert!(!a.contains(&"libvpx".into()));
    }
}
