# Aligned left-panel widths

At desktop viewports (851px+), the common-snippet library manager now uses 1fr/2fr columns, matching the material collection/inspector divider. Both left panels occupy one third of the same full viewport. Existing compact layout remains unchanged. Materials-style proposal has not been applied.

Validation: 20 related E2E passed, including exact cross-tab width comparisons at 940/1280/1920, reachable save action, role/keyboard navigation, all original manager flows and unsaved draft preservation. Isolated screenshots reviewed. Tauri release executable and both Windows installers built successfully.

Formal app upgraded after backup and graceful exit; 6 cached role sessions, settings and drafts restored, all 28 original files hash-identical. Actual installed widths compared equal, native window visible and common-snippet page opened. Private screenshot retained in `.tools/upgrades/aligned-sidebar-install-20261031/installed-library.png`. No Computer Use.
