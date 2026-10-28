# Manager arrow-key navigation (v0.4.5)

Left/Right switches roles with wraparound through the same `switchRole` path used by role cards. Up/Down selects only visible filtered snippets, wraps, and scrolls the selected row into view. Each role retains selection, query, version baseline, drafts and validation state. Selection does not save or paste text.

Navigation is suppressed for text editors, contenteditable fields, native input/select controls, composition/IME, modified shortcuts, dialogs, the settings page, saves and pending role loads. The existing role-card Home/End focus behavior remains. Left/Right on a card now activates the role rather than just moving focus.

Verification:

- `tests/manager-navigation.test.js`: direction mapping, editing/IME/modifier guards, filtered-list wrap, empty and hidden selection.
- `tests/e2e/manager-navigation.spec.js`: draft/scenario retention, remembered role selection, focused role cards, search filtering and empty results, normal text cursor behavior, dialogs, settings, delayed requests, duplicate prevention and failure recovery. Global console/page error assertions remain enabled.
- Full browser suite: 34 passed. Node suite: 44 passed. Production build succeeded.
- Actual installed manager: dispatched DOM arrow events through the production handlers, observed native role changes, and restored the original role, selection and editor values. No system keyboard/mouse injection or external chat interaction was used. All original JSON files and settings were preserved during upgrade.
