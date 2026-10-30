# Right-side role carousel layout

- Branch: `codex/swiss-workspace-layout`.
- Common-snippet page: role carousel sits at the top of the right editor workspace, before role status and heading. Left sidebar retains search, reorder controls, snippet list and add button.
- Materials/settings pages retain the existing sidebar carousel. The same DOM controls move between containers; no role cache, save contract or storage schema changes.
- Existing arrow scrolling, wheel scrolling and keyboard role navigation remain in place.
- Tested screenshots use isolated sample data at 940x820 and 1280x860; no personal content is committed.
- Added E2E verifies right-side geometry, reachable save action, materials/settings round trips and unsaved draft preservation without saving.
- Validation: node tests 55 passed; component tests 15 passed; full E2E and native installation results recorded after completion.
- First E2E run encountered a shared trace-output cleanup collision from a second runner. Full suite rerun uses a distinct output directory.
- Computer Use was not used. Upgrade preserves role sessions, dirty flags, saved baselines, settings inputs and material edits; private snapshots stay under ignored `.tools/upgrades/`.

Completed: 55/55 node, 15/15 component, 76/76 full E2E passed. Tauri release build and both Windows installer bundles succeeded. Formal root executable replaced after graceful exit. Restored 6 role sessions and verified all 25 existing data files unchanged, along with cached drafts/settings and capture options. Native application opened on common-snippet page, right-side role geometry and visible save button verified. Screenshot of actual installed WebView retained privately in `.tools/upgrades/right-roles-install-20261031/installed-library.png`.
