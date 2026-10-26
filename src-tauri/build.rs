fn main() {
    for icon in ["icons/icon.ico", "icons/icon.png", "icons/icon.icns", "icons/tray.rgba"] {
        println!("cargo:rerun-if-changed={icon}");
    }
    tauri_build::build()
}
