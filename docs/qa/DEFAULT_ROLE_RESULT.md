# Starred default picker role

Each role card has a separate top-right star button, without nesting interactive buttons. A filled star identifies the one preferred role for opening the snippet picker; clicking it again clears the preference. No preference preserves the existing current-role behavior. Clicking a star does not switch the editor, save snippets or replace drafts. Preference changes preserve carousel position. Tooltips use the configured shortcut and labels support all four UI languages.

The preference is atomically persisted in `default-role.json`, separately from `roles.json` (last manager/pasted role). Main-window-only IPC reads/writes it and emits a UI update. Native Alt+H Begin resolves the preferred role, loads its saved snippets or localized built-ins without seeding new files, and starts the picker on its first row. Picker role navigation stays temporary; selecting/pasting a role follows the existing activation path without changing the star.

Tests cover independent preference persistence, legacy fallback, clear/invalid role behavior, localized defaults and no snippet file rewrites; UI star selection/clear/reload, single preference, editor draft preservation, failure rollback and translated labels. Existing role scrolling/Home/End logic selects role buttons separately from stars.

The first full browser run passed 86 tests; one case was interrupted by a Vite reload while source/build generation was changing. After freezing the build, that module and default-role/carousel cases were rerun. Final results and installed-state checks follow. No Computer Use.

Completed: JS 55/55 and component 15/15 passed. Native full unit/integration suites passed (one pre-existing ignored test). Browser run 86 passed plus one HMR/navigation interruption; stable targeted rerun 10/10 passed, including the affected case and all new preference/card tests. Release executable and Windows installer bundles built.

Formal app upgraded after backup and graceful exit, restoring 6 cached role sessions/settings/drafts; all 28 existing data files hash-identical. Verified 13 actual star controls and registered native read IPC without setting a preference on the user's behalf. Opened library page; private installed screenshot retained in `.tools/upgrades/default-role-install-20261031/installed-library.png`. No desktop hotkey injection or Computer Use.
