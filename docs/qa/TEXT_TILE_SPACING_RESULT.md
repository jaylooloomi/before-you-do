# Text tile editor spacing

Text tiles now reserve separate header and bottom-menu zones (34px top, 32px bottom). The editor flexes in the remaining card area, and its focus outline is drawn inward. Number/title, focused editor frame and overflow menu no longer share the same space. Other material tile sizes and controls are unchanged.

A semantic browser geometry test checks the focused editor against header/number and menu boundaries in light/dark at 940px and 1280px, preserves typed text, and confirms the original snippet draft survives returning to library. Geometry is measured atomically in one browser frame to avoid mixing coordinates across the media-query layout update. Initial sequential coordinate reads caught that test timing issue; the production screenshot already showed correct separation.

Validation and installation results follow. No Computer Use.

Completed: 12 related E2E passed, including atomic focus geometry in both themes/viewports, text preservation, numbering, opening and material shortcuts. Tauri executable and both Windows bundles built successfully. Formal upgrade restored 6 cached role sessions/settings/drafts; all 28 existing files hash-identical. Verified installed stylesheet contains the spacing and inward focus-ring rules, application unlocked and native window visible. No new test materials were inserted into the user's running app.
