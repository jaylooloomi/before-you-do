# Prompt workspace and capture verification

Historical baseline for 0ba4c20. For the subsequent platform split and macOS implementation, see [CAPTURE_PLATFORM_RESULT.md](CAPTURE_PLATFORM_RESULT.md).

Date: 2026-10-29 (Asia/Taipei)
Branch: `codex/prompt-material-capture`
Build version: `0.5.0` (development; not a published release)

## Scope and architecture

- Independent sidebar page, separate from the reusable snippet editor and Settings & AI guide.
- Region capture freezes the complete virtual desktop before displaying a preloaded, borderless, topmost selection window. Drag coordinates are converted from WebView CSS pixels to the frozen bitmap's physical pixels; reverse drags and boundary clipping are handled. Esc and native window close cancel without adding a material.
- Windows screenshots use a new Rust/Win32 implementation: desktop DC, compatible bitmap/DC, `BitBlt`, `GetDIBits`, BGRA-to-RGBA conversion, PNG encoding and explicit handle cleanup. No ShareX implementation was copied into the application.
- Active-window target uses foreground-window events (`SetWinEventHook`) to remember the last external application. It does not poll, inspect its text, inject input, or activate that application. Screenshot bounds use DWM extended frame bounds, with a window-rectangle fallback, clipped to the virtual desktop.
- These screenshots capture visible desktop pixels. Occluded/protected window content is not guaranteed. Native screen capture is Windows-only in this increment; unsupported platforms return an explicit error without changing materials or snippets.
- Existing Alt+H registration/picker semantics are unchanged. Keyboard navigation and Ctrl/Cmd+S cannot accidentally edit/save snippets while the materials page is open. During region selection the picker is suppressed to prevent an accidental paste into the overlay.
- Materials use `prompt-materials/session.json` and managed attachment copies alongside, never inside, snippet/settings files. Mutations commit a new JSON state before replacing in-memory state. Corrupt material metadata is read-only and does not prevent the snippet app from starting.
- Text drafts are debounced to disk, with a separate localStorage recovery entry written synchronously on input. Persistence failure keeps the text/recovery draft; navigation and actual quit flush pending text first. Autosave does not disable the focused text input.
- Files: max 25 MB each, max 100 MB attachment total, max 100 items, max 100,000 characters per text. PNG/JPEG/GIF/WebP use raster previews; arbitrary other files remain attachments. Filenames and persisted IDs cannot introduce parent paths or Windows reserved output names.
- Export writes a new directory containing prompt.md, numbered attachment copies and manifest.json; the directory is published by rename after all writes succeed. Copying text inserts attachment references, not file bytes. No automatic upload, multi-attachment paste or sending is claimed.

## Test matrix

- [x] PM-B01: physical crop uses correct pixel rows and rejects empty/out-of-bounds/overflow coordinates.
- [x] PM-B02: PNG round trip preserves RGBA pixels.
- [x] PM-B03: exact reorder permutation; duplicates and unknown IDs rejected.
- [x] PM-B04: persistence/reload isolation; failed disk writes do not replace memory.
- [x] PM-B05: corrupt metadata cannot be overwritten; invalid output names rejected.
- [x] PM-N01: actual Windows full desktop capture: origin (-1920, 0), dimensions 3840x1080.
- [x] PM-N02: actual foreground external-window capture: 1920x1040 in this run.
- [x] PM-N03: native 160x120 crop and three PNG outputs decoded independently with Pillow; all opaque RGBA and nonblank.
- [x] PM-N04: actual managed attachment/image persistence and new export directory contents verified in an isolated output directory.
- [x] PM-C01: autosave retains focus; script-like user text remains literal.
- [x] PM-C02: failed save retains recovery draft; retry writes exact contents.
- [x] PM-E01: snippet draft -> materials text/files/reorder/copy/export -> return retains original unsaved snippet; reload retains materials.
- [x] PM-E02: three capture command modes; busy controls prevent repeated actions; error/retry keeps text.
- [x] PM-E03: save rejection prevents leaving; retry recovers.
- [x] PM-E04: region overlay drag maps CSS coordinates to physical pixels; Escape sends cancellation.
- [x] PM-E05: core controls visible at native minimum 780x680; Traditional Chinese, Simplified Chinese, English and Japanese switching.
- [x] PM-E06: immediate reload before autosave recovers pending text without a snippet write.
- [x] PM-R01: all existing browser journeys, including Alt+H manager dismiss, picker rendering, settings, import, language, roles, save and quit guards.

## Executed verification

- `npm test`: 46 passed.
- `npm run test:components`: 11 passed. Materials module line coverage 88.57% in this component run; this is not whole-product coverage.
- `npm run test:e2e`: two full successful runs, 40 passed each, 0 skipped, 0 flaky; every test checks console.error and pageerror. Browser tests use an explicit IPC boundary double.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 35 unit + 16 integration executions passed. One pre-existing native hotkey-registration test remains opt-in/ignored because it registers real global hotkeys; it was not enabled while the user's existing app was running.
- `npm run build -- --no-bundle`: formal Windows build, not Vite-only preview.
- Native audit: run the formal executable as `before-you-do.exe --material-capture-audit <fresh-output-directory>`. It bypasses app startup, records three PNGs, validates managed persistence/export, writes result.json, and exits without touching app configuration, clipboard, startup registration, or keyboard/mouse input. Use an empty/new directory for each run.
- Local UI screenshot reviewed: `artifacts/prompt-material-workspace.png`. Native screenshot evidence is private/ignored in `artifacts/prompt-native-audit/`; it is not included in Git or the README.

## Practical limits

- No actual OS keyboard/mouse input was used. A physical user drag across mixed-DPI monitors and a real external Alt+H paste were not exercised by this run; overlay interactions were tested headlessly and pixel geometry/native capture separately.
- macOS screen capture is not implemented in this increment. Existing macOS snippet functionality remains on its existing code path.
- New screenshot hotkeys, clipboard history, screenshot annotations, recording/GIF, automatic multimodal paste, and cloud synchronization are outside this increment.
- The user's running original executable was not restarted. Its in-memory drafts remain in that same process; 20 original JSON/settings/backup files were compared by SHA-256 before/after verification and remained unchanged. Original process PID 59516 remained running.
