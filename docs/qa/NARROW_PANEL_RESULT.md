# Narrower material inspector

The entire right panel (preview, details and export actions) is now 80% of its former width: 338 -> 270.4 px at standard desktop widths, 250 -> 200 px below 1150 px, and 360 -> 288 px at 1500 px and above. Center grid receives the freed space. Small-window footer behavior is unchanged.

Validation: 18 related E2E tests passed, covering exact panel dimensions at three desktop viewports, reachable export/copy actions, four languages, gallery ordering/playback, role navigation, capture tools and draft preservation. The new geometry test also passed separately with semantic complementary-region locator. Release executable and MSI/NSIS bundles built successfully.

Formal app replaced through graceful exit, after private file/session backups. All 6 cached role sessions restored, settings and unsaved input state verified, all 25 existing data files hash-identical. Installed app opened on materials page; actual panel width and visible export action verified. No Computer Use. Personal screenshots/backups remain in ignored `.tools/upgrades/narrow-panel-install-20261031/`.
