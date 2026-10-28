# Picker monitor regression

Root cause: `Action::Begin` used the picker's `current_monitor()` and `center()`, so it reused its old display regardless of the target HWND.

Windows now resolves the monitor with `MonitorFromWindow` using the original paste target. Tauri identifies the matching display from a point inside that monitor. Placement uses its work area and DPI, moves first, then applies physical size and final physical center. Cursor/primary display information is only a fallback, never the previous picker monitor.

`cargo test --manifest-path src-tauri/Cargo.toml --locked -- --nocapture` includes layout bounds/scaling tests and hidden HWND fixtures on every attached Windows monitor. These fixtures do not show windows, register shortcuts, send input or change foreground focus.

Optional native runtime diagnostic, using a separate executable copy:

```text
before-you-do.exe --design-preview --autostart --picker-position-audit
```

This mode requires isolated preview state. It moves only the hidden picker using hidden target fixtures, tries all displays forward and backward, and writes `before-you-do.monitor-audit.json` beside that executable. Each check records the real resulting position, size, scale, monitor and hidden state. Stop only the diagnostic copy afterward. Normal app launches never run the audit.

When another copy is running, set `WEBVIEW2_USER_DATA_FOLDER` to a separate temporary directory for the diagnostic process so WebView2 profiles do not conflict. The recorded result is [PICKER_MONITOR_RESULT.json](PICKER_MONITOR_RESULT.json): two attached 100% Windows displays, four successful forward/reverse checks, including a display with a negative X origin. 150%/200% combinations are covered by layout tests, not by changing the user's actual display settings.

Limit: no external app keyboard or paste injection is used. macOS target IDs are process IDs, so it uses the cursor-display fallback and still needs physical Mac verification.
