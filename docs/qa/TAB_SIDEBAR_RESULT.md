# Tab-specific sidebar visibility

The common-snippet sidebar is now visible only on the common-snippet library tab. Materials and Settings/AI Guide hide the direct manager sidebar and use a single full-width manager column. The material collection / complete inspector ratio stays at 1:2 on desktop, calculated over the full available width; compact-mode behavior remains in place.

This is a CSS visibility/grid change. Sidebar DOM, role sessions, snippet data, editor input and event handlers are retained, so switching back restores the same editor state. Material data, settings and save/exit contracts are unchanged.

Updated existing tests that previously required copying snippets from within materials, fixed inspector x positions or fixed gallery column counts. Added semantic checks for hidden library controls on both non-library tabs, full-width panel geometry at 940/1280/1920, material ratio, and restored draft after returning to library.

Validation and installation results follow. No Computer Use.

Completed: entire browser suite 83/83 passed, including settings copy/import/reload, all four languages, materials, shortcuts, opening, recording and tab draft restoration. Formal release executable and both Windows installer bundles built. Graceful upgrade restored 6 role caches, settings and all drafts; all 28 existing data files hash-identical. Installed materials page verified sidebar display:none, collection starts at x=0, and inspector/collection ratio remains 2. Actual installed screenshot retained privately at `.tools/upgrades/tab-sidebar-install-20261031/installed.png`.
