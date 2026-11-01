# Alt+L native validation — 2026-11-01

The previous implementation activated the materials window and attempted to return foreground focus before pasting. Actual native traces reached `finish-paste` and failed to restore the original window. Browser-only mocks did not cover this Windows activation boundary.

The quick panel now follows the Alt+H architecture: it is non-activating, keeps the original input foreground, receives arrow/Enter/Escape events from the native hook, and commits on modifier release. Closing, committing or cancelling disarms its native keyboard watcher. An already-foreground target is accepted without treating a redundant SetForegroundWindow return value as failure.

Validation completed:

- Real Windows receiver, two consecutive runs: Alt held, L release does nothing, native arrows work, Alt release pastes and closes the panel.
- The receiving process receives real Ctrl+V and CF_HDROP: prompt.md plus an image and a file. Prompt contents and both attachment byte sequences match the fixtures.
- After the panel closes, Right Arrow reaches the original receiver again. Clipboard restoration completes after each run.
- Eight browser hold/navigation/cancellation cases passed (seven in the suite run; the newly added native-key case passed after correcting its readiness wait).
- The production native hook is called with in-memory key records to verify L-up does not commit, arrows are forwarded, and Alt-up commits once, without sending input to user applications.

Run on Windows with the normal app closed:

```powershell
npm run test:native-quick
# Reuse an existing formal build:
powershell.exe -NoProfile -File scripts/test-native-quick.ps1 -SkipBuild
```

The native audit uses an isolated Tauri app-directories override, separate WebView data, test-only materials and a dedicated receiving process. It enters the production toggle handler directly to avoid registering a second conflicting Alt+L; the real global hotkey delivery was separately confirmed in the user's native trace. It sends test input only while the receiving HWND is foreground. This verifies OS clipboard transport into the test receiver, not every third-party application's attachment policies.

Latest repeat-run evidence: `artifacts/qa/native-quick-results.json`. Receiver fixture: `tests/native/quick-materials-receiver.ps1`.

## Clear action update

The footer now has Paste all / Clear / Open main window, with Left/Right selecting among all three. Clear first enters confirmation; Enter or a second confirmation click clears the current workspace. Escape cancels. Main flushes material text drafts before the native clear command. Saved packs remain unchanged and the previous workspace is retained for undo.

13 browser cases passed, including confirmation, cancellation, draft flush, undo and saved-pack preservation. Native pending-state tests and cargo check passed; formal Tauri build passed. The new native repeat run did not complete: the isolated receiver failed to receive synthetic Ctrl+V, despite a successful native paste result. This run does not establish native keyboard end-to-end validation for the new clear action. Previous paste evidence above predates this update.
