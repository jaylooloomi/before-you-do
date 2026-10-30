# Add-material shortcuts

Added paired action/input rows for Add text and Add file. Defaults are Ctrl+Shift+F11/F12; users can edit or blank either binding. The existing capture hotkey config deserializes missing fields with defaults without rewriting the old file. Validation and native registration cover all seven entries; duplicate bindings are rejected, and the existing registration rollback remains in use.

Windows global actions reveal the materials workspace, preserving snippet drafts. Text creates/focuses a text card. File uses an owned native multi-file dialog, preserving selection when canceled and supporting Unicode names. Imported files use existing validation, file/total size limits and material storage. Busy operations suppress repeated action events. Foreground monitor positioning follows the source window. Non-Windows global capture shortcut support remains as before; existing toolbar file input remains available.

Validation: 55 JS tests and 15 component tests passed; 16 related E2E passed, including persistence/disable, actual browser file chooser flow, simulated global events, native-choice IPC boundary, duplicate suppression, draft preservation and small viewport save-button reachability. Native binary unit suite: 54 passed, 1 pre-existing ignored. New native assertions cover legacy config defaults, duplicate new bindings and canceled/single/multiple Unicode file-dialog results. Native OS dialog selection was not automated on the user's desktop. Screenshot uses isolated test fixtures.

The first layout run found the save button below the small popup viewport after adding rows; sticky save action corrected this and the entire related suite passed on rerun. No Computer Use.

Formal build installed after graceful exit. Restored all 6 role sessions and existing settings/drafts; all 26 original data files hash-identical. OS reports all seven bindings registered, including Ctrl+Shift+F11/F12, without conflicts. New app opened on materials shortcut popup, both fields and save action verified visible; actual installed screenshot retained privately in `.tools/upgrades/material-shortcuts-install-20261031/installed-settings.png`.
