# Sign-in startup verification (v0.4.3)

## Expected behavior

- Opt-in switch in Settings & AI guide, localized in four languages; reads the OS registration rather than a separate localStorage flag.
- Login startup passes `--autostart`, keeps both product windows hidden, and registers the tray and shortcut normally. Manual launches open the manager. Duplicate background launches do not foreground an existing instance.
- Writes are blocked while pending. Failure restores the previous checkbox state and displays an error; unsupported environments cannot change the setting.
- Windows registers only `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\before-you-do`, with a quoted executable path. macOS writes `~/Library/LaunchAgents/dev.quicksay.desktop.autostart.plist` with escaped arguments. Preview windows cannot modify OS startup.

## Automated checks

- `npm test`: shared language and snippet regression tests.
- `npm run test:components`: pending/duplicate changes, write rollback, unsupported/read failure states.
- `npm run test:e2e`: four-language labels and statuses, refresh persistence, failure recovery, unchanged snippet files, plus the existing app journeys. Global console/page error checks remain active.
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`: isolated registry roundtrip with Unicode and spaced paths, idempotent removal, LaunchAgent XML escaping, exact background argument recognition, existing storage/picker tests.

## Actual Windows executable verification

The release build was started with `--autostart`. Native window enumeration found both `Tauri Window` product windows hidden; single-instance/event helper windows are excluded from this assertion. Through the formal app IPC, automatic startup was enabled, the actual Run command was read back and verified, and startup was disabled again. The original off setting was restored. The native-backed settings checkbox was readable and enabled. All pre-existing snippet/settings JSON file hashes were unchanged after the check.

## Limits

No sign-out, reboot, or changes to Windows StartupApproved policies were performed. OS policies can override registration. Mac login has not been tested on physical hardware. Moving or deleting a portable executable requires updating/disabling its startup entry. No new runtime package was introduced; the existing windows-sys registry/security features are enabled.
