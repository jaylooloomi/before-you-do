# Left panels at seventy percent

At desktop widths, both the library sidebar and material collection now occupy 7/30 of the viewport (70% of their former one-third width). The right column receives the released space: 23/30. At 1280px this changes the left panel from about 426.7px to 298.7px. The two tab dividers remain aligned. Settings still has no library sidebar; existing compact behavior below 851px remains unchanged.

Updated cross-tab width, sidebar visibility and material ratio assertions to the new requirement. Relevant regression covers manager save/navigation/drafts, role stars, capture settings popup geometry, and material export controls. Only the layout rule changed in production; the pending material-style preview is not applied.

Validation and formal installation results follow. No Computer Use.

Completed: 22 related E2E passed after release build finished, avoiding dev-server reload interference. Screenshots and 940/1280/1920 geometry verified. Executable and Windows installer bundles built successfully. Graceful process shutdown completed before executable replacement; 6 cached role sessions/settings/drafts restored and all 28 original data files hash-identical. Installed library/material panel widths both measured about 298.7px at 1280px (70% of prior 426.7px); native window visible and library opened. Private screenshot in `.tools/upgrades/left-seventy-install-20261031/installed-library.png`.
