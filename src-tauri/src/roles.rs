use crate::storage::{self, Snippet};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub const IDS: [&str; 13] = [
    "personal",
    "agent",
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

// Bonus-05 continuation: distinguish new role files from externally deleted files.
pub struct KnownFiles(std::collections::HashSet<String>);
impl KnownFiles {
    pub fn new(base: &Path) -> Self {
        Self(
            IDS.iter()
                .filter(|id| path(base, id).is_ok_and(|p| p.exists()))
                .map(|id| id.to_string())
                .collect(),
        )
    }
    pub fn path(&self, base: &Path, id: &str) -> Result<PathBuf, String> {
        let file = path(base, id)?;
        if self.0.contains(id) && !file.exists() {
            return Err("error.external_change".into());
        }
        Ok(file)
    }
    pub fn observe(&mut self, id: &str) {
        self.0.insert(id.to_string());
    }
}

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
    fn known_role_deletion_is_not_treated_as_first_use() {
        let dir = std::env::temp_dir().join(format!("quicksay-knownfiles-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let base = dir.join("snippets.json");
        storage::save(&base, &storage::defaults()).unwrap();
        let mut known = KnownFiles::new(&base);
        assert!(known.path(&base, "personal").is_ok());
        assert!(known.path(&base, "developer").is_ok());
        fs::remove_file(&base).unwrap();
        assert_eq!(
            known.path(&base, "personal").unwrap_err(),
            "error.external_change"
        );
        assert!(!base.exists());
        let dev = path(&base, "developer").unwrap();
        storage::save(&dev, &storage::defaults()).unwrap();
        known.observe("developer");
        fs::remove_file(&dev).unwrap();
        assert!(known.path(&base, "developer").is_err());
        assert!(!dev.exists());
        assert!(known.path(&base, "../invalid").is_err());
        let _ = fs::remove_dir_all(dir);
    }

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
            custom: false,
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

// Display/paste projection only: never rewrite stored data on a language change.
pub fn localize(item: &Snippet, id: &str, language: &str) -> Snippet {
    if item.custom {
        return item.clone();
    }
    let Ok(data) =
        serde_json::from_str::<serde_json::Value>(include_str!("../../src/role-localization.json"))
    else {
        return item.clone();
    };
    let Some(variants) = data.get(id) else {
        return item.clone();
    };
    for source in ["zh-TW", "zh-CN", "en", "ja"] {
        if let Ok(originals) = serde_json::from_value::<Vec<Snippet>>(variants[source].clone()) {
            if let Some(index) = originals.iter().position(|t| {
                t.name == item.name
                    && t.text == item.text
                    && (item.scenario.is_none() || item.scenario == t.scenario)
            }) {
                let value = variants.get(language).unwrap_or(&variants["en"]);
                if let Ok(translated) = serde_json::from_value::<Vec<Snippet>>(value.clone()) {
                    let mut result = translated[index].clone();
                    if item.scenario.is_none() {
                        result.scenario = None;
                    }
                    return result;
                }
            }
        }
    }
    item.clone()
}
