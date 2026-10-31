# README screenshot refresh

- Source interface: committed `ede8c774c404e83732880eef82f99eada790e7c2`.
- Captured 20 PNGs: English and Traditional Chinese editions of the snippet manager, Materials, capture shortcuts, Settings, AI guide, JSON workflow, and four role pickers.
- Renderer: headless Chromium against Vite, with isolated browser storage and a browser-only IPC boundary. The running desktop app, OS clipboard and user data folder were never connected.
- Attachments are fictional demonstration data. The sample login screenshot and short silent recording were generated inside the isolated browser; they are not personal desktop captures.
- Console errors: 0. Page errors: 0. Material video decoding, selected role text, visible settings fields and visible save/delete actions were asserted before capture.
- Reviewed representative screenshots in both languages for text, menus, clipping, numbering, previews and bottom action visibility.
- All local README image references were checked for existing files. Both README editions now reference their matching interface language.
- Capture script: `scripts/capture-readme-current.mjs`. Run from a clean checkout with Node dependencies installed; set `README_CAPTURE_COMMIT` to the checkout commit to record provenance.
- Capture manifest: `docs/images/current/capture-manifest.json`.

Uncommitted task-pack work was present during this task. The source was therefore exported with `git archive` into an ignored isolated folder before capture. That unfinished interface and its source changes were excluded from the screenshots and documentation commit.

These are screenshots of the rendered frontend with demo data. They do not constitute new native screenshot/recording, global-hotkey, or macOS hardware verification. The README identifies source-only UI changes newer than the v0.5.0 download.
