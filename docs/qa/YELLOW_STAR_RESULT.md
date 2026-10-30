# Yellow default-role star

The brown appearance was a selected-card theme color override, not a stacking/overlap problem. Removed the dark-brown override and made the pressed SVG use an explicit yellow fill (#ffd54a) plus a thin dark outline (#6b5200), independent of inherited selected-card text color. Unchecked stars remain outlines.

Release executable and both Windows bundles built; 5 related E2E passed (preference persistence/failure/localization, role carousel and tab draft preservation). Reviewed light-theme screenshot and verified the installed dark-theme SVG fill. Formal upgrade restored 6 role caches/settings/drafts and all 29 existing data files hash-identical. Native window visible and library opened; private screenshot under `.tools/upgrades/yellow-star-install-20261031/installed-library.png`. No Computer Use.
