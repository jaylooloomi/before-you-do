# Capture backend implementation and dependency record

Date: 2026-10-29. Feature branch: codex/capture-platform-plan.

The screenshot backend was independently implemented in this repository using platform APIs. ShareX remains an ignored reference clone under temp/ShareX and is not compiled, bundled, linked or copied into the shipped application. The project license remains MIT; this record is not a relicensing of any ShareX code.

| Component | Implementation/dependency | License or distribution |
|---|---|---|
| Capture coordination, image validation, selection sessions and platform adapters | Repository-owned Rust code | Repository MIT license |
| macOS capture bridge | Repository-owned Objective-C compiled into a static library by Apple SDK clang/ar | Repository MIT license; Apple frameworks are supplied by the OS |
| Windows screenshot and foreground APIs | windows-sys 0.61.2 | MIT OR Apache-2.0 (verified from installed crate manifest) |
| PNG encoding | png 0.18.1 | MIT OR Apache-2.0 (verified from installed crate manifest) |
| Image IPC encoding | base64 0.23.1 | MIT OR Apache-2.0 (verified from installed crate manifest) |
| ScreenCaptureKit / AppKit / CoreGraphics / Foundation | System frameworks; no copied SDK implementation or separate capture executable | Apple platform components |

Existing Tauri, WebView and transitive dependency obligations still apply. No .NET, Avalonia, SkiaSharp or ShareX runtime is added by this feature. The bridge introduces no new Rust dependency; existing PNG/base64 dependencies were added in the preceding materials feature.

ScreenCaptureKit is weak-linked, and calls requiring it are protected by an availability check for macOS 14+. Existing app minimum remains macOS 11. CI verifies the resulting Mach-O LC_LOAD_WEAK_DYLIB entry; an actual macOS 11–13 launch remains an explicit hardware validation item.

Implementation references (API contracts, not copied application code):

- https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager
- https://developer.apple.com/documentation/screencapturekit/scshareablecontent/getexcludingdesktopwindows(_:onscreenwindowsonly:completionhandler:)
- https://developer.apple.com/documentation/coregraphics/cgpreflightscreencaptureaccess()
- https://learn.microsoft.com/en-us/windows/win32/gdi/capturing-an-image
