# Top-level tabs replace duplicate back buttons

Removed the Back to snippets buttons from Materials and Settings/AI Guide. Navigation now uses the persistent top-level Common snippets tab. Removed the unused internal back callbacks and the materials back-button positioning rules.

Existing E2E back helpers and material failure/recovery journeys now use the top navigation. The tab sidebar regression explicitly checks both pages have no Back to snippets button. The top navigation retains the existing material flush/failure guard, so a failed material save blocks switching tabs and preserves the editor.

Validation and installation results follow. No Computer Use.

Completed: 15 component tests and all 20 related E2E passed, including material flush failures/retry, pending text recovery, settings copy/import/reload, four languages, permissions and tab switching. Release executable and both Windows installer bundles built. Formal upgrade restored 6 role sessions and all settings/drafts; all 29 original data files hash-identical. Installed DOM confirms neither back button exists, top-level Materials tab opened and native window visible. Private screenshot at `.tools/upgrades/tab-navigation-install-20261031/installed-materials.png`.
