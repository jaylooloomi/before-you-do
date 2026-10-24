use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::Path};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Snippet {
    pub name: String,
    pub text: String,
}

pub fn defaults() -> Vec<Snippet> {
    serde_json::from_str(include_str!("../../src/templates.json"))
        .expect("valid built-in templates")
}

pub fn validate(items: &[Snippet]) -> Result<(), String> {
    if items.is_empty() || items.len() > 100 {
        return Err("error.storage_count".into());
    }
    for s in items {
        if s.name.trim().is_empty()
            || s.text.trim().is_empty()
            || s.name.chars().count() > 100
            || s.text.chars().count() > 20000
        {
            return Err("error.storage_invalid".into());
        }
    }
    Ok(())
}

#[derive(Deserialize)]
struct Legacy {
    #[serde(rename = "Items")]
    items: LegacyItems,
}
#[derive(Deserialize)]
struct LegacyItems {
    #[serde(rename = "Snippet", default)]
    items: Vec<LegacySnippet>,
}
#[derive(Deserialize)]
struct LegacySnippet {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "Text")]
    text: String,
}
fn legacy(xml: &str) -> Result<Vec<Snippet>, String> {
    let settings: Legacy = quick_xml::de::from_str(xml).map_err(|e| e.to_string())?;
    let items: Vec<_> = settings
        .items
        .items
        .into_iter()
        .map(|s| Snippet {
            name: s.name,
            text: s.text,
        })
        .collect();
    validate(&items)?;
    Ok(items)
}
pub fn load(path: &Path, old: Option<&Path>) -> Result<Vec<Snippet>, String> {
    let items = if path.exists() {
        serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|e| format!("error.read: {e}"))?
    } else if let Some(old) = old.filter(|p| p.exists()) {
        legacy(&fs::read_to_string(old).map_err(|e| e.to_string())?)?
    } else {
        defaults()
    };
    validate(&items)?;
    Ok(items)
}
pub fn save(path: &Path, items: &[Snippet]) -> Result<(), String> {
    validate(items)?;
    fs::create_dir_all(path.parent().ok_or("error.io")?).map_err(|e| e.to_string())?;
    let bytes = serde_json::to_vec_pretty(items).map_err(|e| e.to_string())?;
    let temp = path.with_extension("tmp");
    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    if path.exists() {
        fs::copy(path, path.with_extension("json.bak")).map_err(|e| e.to_string())?;
    }
    fs::rename(&temp, path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn imports_dotnet_unicode_xml() {
        let xml = r#"<?xml version="1.0"?><Settings><Modifiers>1</Modifiers><Key>72</Key><Items><Snippet><Name>中文 &amp; 名稱</Name><Text>第一行
第二行</Text></Snippet></Items></Settings>"#;
        let s = legacy(xml).unwrap();
        assert_eq!(s[0].name, "中文 & 名稱");
        assert_eq!(s[0].text, "第一行\n第二行");
    }
    #[test]
    fn invalid_or_empty_data_is_rejected() {
        assert!(validate(&[]).is_err());
        assert!(validate(&[Snippet {
            name: "a".into(),
            text: " ".into()
        }])
        .is_err());
    }
    #[test]
    fn save_roundtrip_and_backup() {
        let dir = std::env::temp_dir().join(format!("quicksay-test-{}", std::process::id()));
        let path = dir.join("snippets.json");
        let first = defaults();
        save(&path, &first).unwrap();
        let second = vec![first[1].clone()];
        save(&path, &second).unwrap();
        assert_eq!(load(&path, None).unwrap(), second);
        assert_eq!(load(&path.with_extension("json.bak"), None).unwrap(), first);
        let _ = fs::remove_dir_all(dir);
    }
    #[test]
    fn corrupt_data_is_not_silently_replaced() {
        let dir = std::env::temp_dir().join(format!("quicksay-corrupt-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("snippets.json");
        fs::write(&path, b"broken").unwrap();
        assert!(load(&path, None).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "broken");
        let _ = fs::remove_dir_all(dir);
    }
}
