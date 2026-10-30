# Material collection / preview ratio

Desktop materials page now divides its two panels 1:2: the material collection occupies one third, and the complete preview/details/export panel occupies two thirds. This supersedes the earlier fixed narrower inspector widths. The snippet sidebar is outside this ratio. Below the existing 850px breakpoint, the compact single-column/footer layout remains.

The narrower collection uses wrapped toolbar rows, responsive card columns, stacked header hints and wrapped intro text. The capture-settings popover can extend across the two-panel workspace rather than compressing its inputs to the collection width. Preview media uses available width with a viewport height limit.

Updated existing geometry tests for the new ratio/wrapping rather than the old fixed inspector widths and three-column gallery assumption. Test collection has an accessible named region for semantic geometry checks.

Validation completed: 15 related E2E passed, including 940/1280/1920 ratio measurements, 780 compact mode, four-language layout, toolbar popup reachability, drag sorting and draft preservation. Tauri release build and Windows bundles succeeded. Formal app installed after session/data backup and graceful exit; all 6 role caches restored and all 26 existing data files hash-identical. Installed panel ratio and visible export action verified. Private screenshot retained at `.tools/upgrades/panel-ratio-install-20261031/installed.png`. No Computer Use.
