# Alt+H Settings/Add manager monitor regression (v0.4.6)

The previous picker fix moved only the popup. `Selection::Settings` and `Selection::Add` discarded the original HWND, and `manage()` simply showed the manager at its old location.

Both selection variants now carry the originating target. The Settings and Add activation paths pass it to `manage_from_target`, which positions the manager before showing/focusing it. The shared layout helper preserves the original logical size once across DPI changes, fits the target work area and adjusts minimum bounds. Standard tray and normal launch behavior remain unchanged. No frontend page choice was changed: the picker Settings action still opens the snippet manager.

Verification:

- Native selection tests require Settings/Add to return the original target (`123`) and continue to enforce cancel/commit-once behavior.
- Manager layout unit test covers a negative-origin monitor and a smaller 150% destination.
- [MANAGER_MONITOR_RESULT.json](MANAGER_MONITOR_RESULT.json) records eight passing checks: both hidden windows, on two attached 100% Windows displays, traversed forward/reverse. No external chat input, keyboard/mouse injection or focus changes were used. Synthetic layout tests cover mixed scales; real mixed-DPI and Mac hardware are not claimed as manually tested.
- All saved files, preferences and captured role/draft state are preserved when updating the local executable.
