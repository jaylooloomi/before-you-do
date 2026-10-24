use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::Path};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Shortcut {
    pub modifier: String,
    pub key: String,
}
impl Default for Shortcut {
    fn default() -> Self {
        Self {
            modifier: "alt".into(),
            key: "H".into(),
        }
    }
}
impl Shortcut {
    pub fn validate(&self) -> Result<(), String> {
        if !["alt", "ctrl", "altShift", "ctrlShift"].contains(&self.modifier.as_str())
            || !(self.key == "Space"
                || self.key.len() == 1
                    && self
                        .key
                        .bytes()
                        .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()))
        {
            return Err("error.shortcut_invalid".into());
        }
        if self.modifier == "ctrl"
            && ["A", "C", "V", "X", "Z", "Y", "S"].contains(&self.key.as_str())
        {
            return Err("error.shortcut_reserved".into());
        }
        Ok(())
    }
    pub fn windows_modifiers(&self) -> u32 {
        match self.modifier.as_str() {
            "ctrl" => 2,
            "altShift" => 5,
            "ctrlShift" => 6,
            _ => 1,
        }
    }
    pub fn windows_key(&self) -> u32 {
        if self.key == "Space" {
            32
        } else {
            self.key.as_bytes()[0] as u32
        }
    }
    #[cfg(any(target_os = "macos", test))]
    pub fn mac_key(&self) -> u16 {
        let keys = [
            "A", "S", "D", "F", "H", "G", "Z", "X", "C", "V", "", "B", "Q", "W", "E", "R", "Y",
            "T", "1", "2", "3", "4", "6", "5", "", "9", "7", "", "8", "0", "", "O", "U", "", "I",
            "P", "", "L", "J", "", "K", "", "", "", "", "N", "M",
        ];
        if self.key == "Space" {
            49
        } else {
            keys.iter()
                .position(|key| *key == self.key)
                .expect("validated key") as u16
        }
    }
    #[cfg(any(target_os = "macos", test))]
    pub fn mac_modifiers(&self) -> u64 {
        match self.modifier.as_str() {
            "ctrl" => 1 << 18,
            "altShift" => (1 << 19) | (1 << 17),
            "ctrlShift" => (1 << 18) | (1 << 17),
            _ => 1 << 19,
        }
    }
}
pub fn load(path: &Path) -> Result<Shortcut, String> {
    if !path.exists() {
        return Ok(Shortcut::default());
    }
    let value: Shortcut = serde_json::from_slice(&fs::read(path).map_err(|_| "error.io")?)
        .map_err(|_| "error.shortcut_file")?;
    value.validate()?;
    Ok(value)
}
pub fn save(path: &Path, shortcut: &Shortcut) -> Result<(), String> {
    shortcut.validate()?;
    fs::create_dir_all(path.parent().ok_or("error.io")?).map_err(|_| "error.io")?;
    let temporary = path.with_extension("tmp");
    let mut file = fs::File::create(&temporary).map_err(|_| "error.io")?;
    file.write_all(&serde_json::to_vec_pretty(shortcut).map_err(|_| "error.io")?)
        .and_then(|_| file.sync_all())
        .map_err(|_| "error.io")?;
    drop(file);
    fs::rename(temporary, path).map_err(|_| "error.io".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_validation_and_platform_codes() {
        assert_eq!(Shortcut::default().windows_key(), 0x48);
        assert_eq!(Shortcut::default().mac_key(), 4);
        for modifier in ["alt", "ctrl", "altShift", "ctrlShift"] {
            for key in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                .chars()
                .map(|c| c.to_string())
                .chain(["Space".into()])
            {
                let value = Shortcut {
                    modifier: modifier.into(),
                    key,
                };
                if value.validate().is_ok() {
                    assert!(value.windows_modifiers() > 0);
                    assert!(value.mac_modifiers() > 0);
                    assert!(value.mac_key() <= 49);
                }
            }
        }
        for (modifier, key) in [
            ("none", "H"),
            ("alt", "Escape"),
            ("alt", "h"),
            ("ctrl", "V"),
            ("ctrl", "S"),
        ] {
            assert!(Shortcut {
                modifier: modifier.into(),
                key: key.into()
            }
            .validate()
            .is_err());
        }
    }
    #[test]
    fn persistence_is_separate_and_invalid_file_is_preserved() {
        let dir =
            std::env::temp_dir().join(format!("before-you-do-shortcut-{}", std::process::id()));
        let path = dir.join("shortcut.json");
        let _ = fs::remove_file(&path);
        assert_eq!(load(&path).unwrap(), Shortcut::default());
        let value = Shortcut {
            modifier: "ctrlShift".into(),
            key: "J".into(),
        };
        save(&path, &value).unwrap();
        assert_eq!(load(&path).unwrap(), value);
        fs::write(&path, "broken").unwrap();
        assert!(load(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "broken");
        let _ = fs::remove_dir_all(dir);
    }
}
