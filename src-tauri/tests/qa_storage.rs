// Compile the unmodified production modules into an isolated integration target.
#[path = "../src/roles.rs"]
mod roles;
#[path = "../src/shortcut.rs"]
mod shortcut;
#[path = "../src/storage.rs"]
mod storage;
use std::fs;
struct Sandbox(std::path::PathBuf);
impl Sandbox {
    fn new() -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        static NEXT: AtomicU64 = AtomicU64::new(0);
        loop {
            let p = std::env::temp_dir().join(format!(
                "byd-qa-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            // Exclusive creation: never adopt another test's directory on coarse clocks.
            match fs::create_dir(&p) {
                Ok(()) => return Self(p),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => panic!("Cannot create isolated test directory: {error}"),
            }
        }
    }
}
#[test]
fn b00_parallel_sandboxes_never_share_files_or_cleanup() {
    let barrier = std::sync::Barrier::new(32);
    let paths = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..32)
            .map(|id| {
                let barrier = &barrier;
                scope.spawn(move || {
                    let sandbox = Sandbox::new();
                    let marker = sandbox.0.join("owner.txt");
                    fs::write(&marker, id.to_string()).unwrap();
                    barrier.wait();
                    assert_eq!(fs::read_to_string(&marker).unwrap(), id.to_string());
                    sandbox.0.clone()
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>()
    });
    assert_eq!(
        paths.iter().collect::<std::collections::HashSet<_>>().len(),
        32
    );
    assert!(paths.iter().all(|path| !path.exists()));
}
impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn item(name: String) -> storage::Snippet {
    storage::Snippet {
        name,
        text: "正文 ' <script>".into(),
        scenario: Some("情境".into()),
        custom: false,
    }
}
#[test]
fn b01_boundaries_never_modify_valid_data() {
    let d = Sandbox::new();
    let p = d.0.join("snippets.json");
    let valid = vec![item("字".repeat(100))];
    storage::save(&p, &valid).unwrap();
    let original = fs::read(&p).unwrap();
    for invalid in [
        vec![],
        vec![item(" ".into())],
        vec![item("字".repeat(101))],
        vec![item("n".into()); 101],
    ] {
        assert!(storage::save(&p, &invalid).is_err());
        assert_eq!(fs::read(&p).unwrap(), original);
    }
}
#[test]
fn b02_filesystem_roundtrip_backup_and_roles() {
    let d = Sandbox::new();
    let p = d.0.join("snippets.json");
    let first = vec![item("first".into())];
    let second = vec![item("second".into()), item("third".into())];
    storage::save(&p, &first).unwrap();
    storage::save(&p, &second).unwrap();
    assert_eq!(storage::load(&p, None).unwrap(), second);
    assert_eq!(
        storage::load(&p.with_extension("json.bak"), None).unwrap(),
        first
    );
    for id in roles::IDS {
        assert!(roles::path(&p, id).unwrap().starts_with(&d.0));
    }
    assert!(roles::path(&p, "../escape").is_err());
    roles::remember(&p, "developer").unwrap();
    assert_eq!(roles::active(&p).unwrap(), "developer");
}
#[test]
fn b03_corruption_and_stale_snapshot_are_read_only() {
    let d = Sandbox::new();
    let p = d.0.join("snippets.json");
    let original = vec![item("original".into())];
    storage::save(&p, &original).unwrap();
    let snapshot = storage::SavedSnapshot {
        items: original,
        exists: true,
    };
    fs::write(&p, b"{broken").unwrap();
    assert!(storage::check_snapshot(&p, &snapshot).is_err());
    assert_eq!(fs::read(&p).unwrap(), b"{broken");
    fs::remove_file(&p).unwrap();
    assert!(storage::check_snapshot(&p, &snapshot).is_err());
    assert!(!p.exists());
}
#[test]
fn b06_native_unicode_boundary_fixture() {
    let data = vec![item("😀".repeat(100))];
    assert!(storage::validate(&data).is_ok());
    assert_eq!(data[0].name.chars().count(), 100);
    let valid = storage::Snippet {
        name: "😀".repeat(100),
        text: "😀".repeat(20000),
        scenario: Some("😀".repeat(1000)),
        custom: false,
    };
    assert!(storage::validate(&[valid.clone()]).is_ok());
    for field in ["name", "text", "scenario"] {
        let mut too_long = valid.clone();
        match field {
            "name" => too_long.name.push('😀'),
            "text" => too_long.text.push('😀'),
            _ => too_long.scenario.as_mut().unwrap().push('😀'),
        }
        assert!(storage::validate(&[too_long]).is_err());
    }
}
