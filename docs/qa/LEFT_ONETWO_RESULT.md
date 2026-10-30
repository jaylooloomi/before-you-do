# Left panels enlarged 1.2x

The current desktop left panel increases from 7/30 of the viewport to 7/25 (28%), a 1.2x multiplier. Both the common-snippet sidebar and material collection stay equal-width. At 1280px the width grows from about 298.7px to 358.4px. Window size stays fixed and the right pane receives the remaining 72%. Compact mode remains unchanged.

The earlier question about shrinking the right pane to 70% was not resolved or applied; this change only follows the latest left-pane sizing instruction. The separate material-style preview also remains unapplied.

Updated geometry expectations; validation and formal installation results follow. No Computer Use.

Completed: release executable and both Windows bundles built, then all 22 related E2E passed. Verified aligned widths and desktop ratio at 940/1280/1920, manager/draft flows, settings visibility, role stars and capture popup reachability. Graceful upgrade restored 6 role caches and all settings/drafts; all 29 existing data files hash-identical. Actual installed library and material left columns both measured about 358.4px at 1280px, 1.2 times the prior 298.7px. Native window visible and library opened. Private screenshot under `.tools/upgrades/left-onetwo-install-20261031/installed-library.png`.
