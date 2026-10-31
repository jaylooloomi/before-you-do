# Named task packs

The prompt workspace can create named task packs and switch between them. Each pack retains its own materials, order and text drafts; the selected pack is restored on startup. Names are trimmed, must contain 1–80 characters, and are unique ignoring case. Cancelling creation leaves the current pack unchanged.

Switching first flushes pending edits. A save failure keeps the current pack selected and retains the draft. Controls are locked during a switch. Native capture and recording must finish before switching. Copy and export use only the selected pack; exported `manifest.json` includes its ID and name.

## Storage and migration

`prompt-materials/session.json` now stores a versioned collection with an active pack ID. Existing single-bundle data becomes the `legacy` pack named “My task”. Before migration, the original bytes are saved as `session.legacy.json`; the original asset files stay in place. The original session is replaced only when a change is saved. No migration resets or deletes content.

Writes serialize the complete collection to `session.json.tmp`, flush it, then rename it over the committed session. Startup uses the committed session and ignores an interrupted temporary write. Invalid committed data blocks writes instead of resetting the store. Draft recovery retains the original local-storage key for the legacy pack and uses pack-specific keys for new packs. This provides process-crash recovery, not a guarantee against hardware failure or browser storage being cleared.

The format is intended for this updated application; older builds do not understand the collection schema. This change does not install or restart the desktop application.

## Verification

- Rust `materials::` tests exercise exact legacy-byte backup, asset retention, separate same-named attachments, ordering, restart selection, duplicate and invalid names, correct exports, interrupted temporary writes, and failed persistence preserving committed state.
- Browser `task-packs.spec.js` uses synthetic data and a test IPC bridge to exercise create/cancel, duplicates, switching with pending text, immediate reload recovery, first copy after recovery, and a failed save blocking selection changes.
- Browser tests do not validate an installed desktop build. Existing material and image-editor tests provide regression coverage.

For acceptance in an isolated updated build: create two named packs with different sample images and drafts, reorder each, switch repeatedly, restart, then compare each export's prompt, attachments and task-pack metadata. Do not use real customer files for this check.
