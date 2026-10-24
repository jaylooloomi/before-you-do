use crate::storage::{self, Snippet};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub const IDS: [&str; 12] = [
    "personal",
    "developer",
    "writer",
    "researcher",
    "designer",
    "frontend",
    "backend",
    "reviewer",
    "tester",
    "product",
    "marketing",
    "project",
];

pub fn path(base: &Path, id: &str) -> Result<PathBuf, String> {
    if !IDS.contains(&id) {
        return Err("error.role_invalid".into());
    }
    Ok(if id == "personal" {
        base.to_path_buf()
    } else {
        base.with_file_name(format!("snippets-{id}.json"))
    })
}

pub fn active(base: &Path) -> Result<String, String> {
    let config = base.with_file_name("roles.json");
    if !config.exists() {
        return Ok("personal".into());
    }
    let id: String = serde_json::from_slice(&fs::read(config).map_err(|e| e.to_string())?)
        .map_err(|_| "error.role_invalid".to_string())?;
    path(base, &id)?;
    Ok(id)
}

pub fn remember(base: &Path, id: &str) -> Result<(), String> {
    path(base, id)?;
    fs::create_dir_all(base.parent().ok_or("error.io")?).map_err(|e| e.to_string())?;
    let config = base.with_file_name("roles.json");
    let temp = base.with_file_name("roles.tmp");
    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    file.write_all(&serde_json::to_vec(id).map_err(|e| e.to_string())?)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(temp, config).map_err(|e| e.to_string())
}

pub fn load(base: &Path, id: &str, defaults: &[Snippet]) -> Result<Vec<Snippet>, String> {
    let target = path(base, id)?;
    if target.exists() {
        storage::load(&target, None)
    } else {
        storage::validate(defaults)?;
        Ok(defaults.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roles_isolate_files_preserve_original_and_remember_selection() {
        let dir = std::env::temp_dir().join(format!("before-you-do-roles-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let base = dir.join("snippets.json");
        storage::save(&base, &storage::defaults()).unwrap();
        let original = fs::read(&base).unwrap();
        assert_eq!(active(&base).unwrap(), "personal");
        let defaults = vec![Snippet {
            name: "角色短句".into(),
            text: "Keep Unicode 日本語".into(),
            scenario: None,
        }];
        let writer = path(&base, "writer").unwrap();
        storage::save(&writer, &load(&base, "writer", &defaults).unwrap()).unwrap();
        remember(&base, "writer").unwrap();
        assert_eq!(active(&base).unwrap(), "writer");
        assert_eq!(load(&base, "writer", &[]).unwrap(), defaults);
        assert_eq!(fs::read(&base).unwrap(), original);
        assert!(path(&base, "../snippets").is_err());
        fs::write(&writer, "broken").unwrap();
        assert!(load(&base, "writer", &defaults).is_err());
        assert_eq!(fs::read_to_string(&writer).unwrap(), "broken");
        fs::write(base.with_file_name("roles.json"), "broken").unwrap();
        assert!(active(&base).is_err());
        let _ = fs::remove_dir_all(dir);
    }
}

pub fn next_id(current: &str, delta: i32) -> &'static str {
    let index = IDS.iter().position(|id| *id == current).unwrap_or(0) as i32;
    IDS[(index + delta).rem_euclid(IDS.len() as i32) as usize]
}
pub fn defaults(id: &str, language: &str) -> Result<Vec<Snippet>, String> {
    let data: serde_json::Value =
        serde_json::from_str(include_str!("../../src/role-defaults.json"))
            .map_err(|e| e.to_string())?;
    let languages = data.get(id).ok_or("error.role_invalid")?;
    let value = languages
        .get(language)
        .or_else(|| languages.get("en"))
        .ok_or("error.role_invalid")?;
    let items: Vec<Snippet> = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
    storage::validate(&items)?;
    Ok(items)
}
