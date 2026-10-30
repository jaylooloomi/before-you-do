# Material sequence references

Every material has a visible positional label (`#01`, `#02`, ...). The selected preview title uses the same label; drag, menu reordering and deletion recalculate all labels from the current list. Text, images, videos and files share one sequence.

Copied prompt sections use `[Material #NN]`; attachment references use `NN-original-name`. The native export writes the same numbered sections and attachment names to `prompt.md`, and adds `number` and attachment `export_name` fields to the exported manifest. Saved item IDs, names, contents and the session storage schema are unchanged.

Tests: JS prompt literal-content assertion; browser test for visible card labels, selected preview after drag/deletion, exact copied prompt and unsaved snippet preservation; native test exports real files (including duplicate original names) in two orders, checks bytes, exact prompt, manifest mappings and unchanged source bundle. Screenshot uses isolated test data. Existing browser fixture fails tests on console/page errors.

Validation and formal installation are recorded after completion. No Computer Use.

Completed: 55 JS unit tests, 15 component tests, all 78 E2E tests, and all 9 native material tests passed. Release executable and both Windows bundles built. First native run revealed a test fixture that persisted reordered data without updating its in-memory store; the fixture was corrected to match the production ordering path and rerun successfully.

Formal upgrade: graceful old-process exit; all 6 cached role sessions/settings/drafts restored and all 26 existing data files hash-identical. New app opened on materials page and actual visible card/preview numbers verified. Private installed screenshot retained under `.tools/upgrades/numbered-materials-install-20261031/installed.png`.
