fn main() {
    for icon in ["icons/icon.ico", "icons/icon.png", "icons/icon.icns", "icons/tray.rgba"] {
        println!("cargo:rerun-if-changed={icon}");
    }
    println!("cargo:rerun-if-changed=native/mac_capture.m");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref()==Ok("macos") {
        use std::{path::PathBuf,process::Command};
        let out=PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
        let object=out.join("mac_capture.o");let archive=out.join("libbyd_capture.a");
        let architecture=if std::env::var("CARGO_CFG_TARGET_ARCH").as_deref()==Ok("aarch64"){"arm64"}else{"x86_64"};
        let status=Command::new("xcrun").args(["--sdk","macosx","clang","-fobjc-arc","-fblocks","-std=gnu11","-mmacosx-version-min=11.0","-arch",architecture,"-c","native/mac_capture.m","-o"]).arg(&object).status().expect("Apple SDK clang is required to build the capture bridge");
        assert!(status.success(),"macOS capture bridge compilation failed");
        let status=Command::new("xcrun").args(["ar","crs"]).arg(&archive).arg(&object).status().expect("Apple SDK ar is required");assert!(status.success(),"capture bridge archive failed");
        println!("cargo:rustc-link-search=native={}",out.display());println!("cargo:rustc-link-lib=static=byd_capture");
        for framework in ["Foundation","AppKit","CoreGraphics"]{println!("cargo:rustc-link-lib=framework={framework}");}
        println!("cargo:rustc-link-lib=objc");
        // ScreenCaptureKit is absent on macOS 11. Weak-link so existing snippet functionality still launches.
        println!("cargo:rustc-link-arg=-Wl,-weak_framework,ScreenCaptureKit");
    }
    tauri_build::build()
}
