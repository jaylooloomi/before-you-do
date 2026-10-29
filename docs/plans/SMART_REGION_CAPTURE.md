# Smart region capture: ShareX research and implementation plan

Date: 2026-10-30. Branch: codex/smart-region-capture.
Reference checkout: temp/ShareX, commit 24b51dad5a71a39bcb72db6b57d174ccfc9bad2e (ignored; not bundled).

## Findings from the reference implementation

- WindowsRectangleList enumerates top-level windows in stacking order, rejects invisible/cloaked/ignored overlays, optionally collects child windows clipped to their parents, and adds a separate client rectangle before the outer window rectangle.
- RegionCaptureWindow.LoadWindowRegionsAsync snapshots geometry and ignores its own overlay. UpdateHover converts image coordinates to desktop coordinates, then uses the ordered list's first containing rectangle. Front windows must take precedence over smaller windows behind them.
- Pointer-down on a hover target enters PendingHover. Moving at least 4 units enters Creating, clearing the candidate identity. Release either commits the clicked candidate or the dragged selection when QuickCapture is enabled. This avoids accidental tiny drags on a clicked window.
- RegionSelectionOverlay draws high-contrast dashed bounds and dims the outside area. UpdateHud and UpdateMagnifier read the frozen image pixels; they do not activate the underlying app or take a new screenshot on every pointer movement.

## Independent implementation

1. Add bounded, in-memory candidate metadata to the frozen Frame. Windows enumerates visible windows/client areas/native child controls, preserving z-order and parent IDs. Exclude this process, cloaked/minimized windows and non-interactive overlays. Do not collect captions, typed text or screenshots per mouse move.
2. macOS reuses already-authorized ScreenCaptureKit content and ordered CoreGraphics window metadata to provide window candidates without requesting Accessibility. Native child-control detection remains Windows-only; manual drag works on both platforms.
3. A pure frontend hit-test chooses the front-most owning window first, then its top visible native control and ancestors. Tab/Shift+Tab cycles that ancestry, allowing selection of the whole window instead of a child. Empty/missing metadata falls back to manual drag.
4. Pointer state distinguishes hover, pending click, and manual drag with a 4 CSS-pixel threshold. A single click captures the highlighted bounds; dragging always overrides the candidate. Escape/right-click cancels. Existing session checks and crop validation remain authoritative.
5. Add a dashed outline, clear spotlight, X/Y/W/H badge, and a circular nearest-neighbor pixel magnifier. Draw on requestAnimationFrame only when inputs change; clamp HUDs and magnifier sampling at screen edges. Never activate other apps.
6. Retain four-language help, opt-out controls for automatic detection and magnifier, and keyboard cancellation. No changes to Alt+H, snippets, startup settings or material files.

## Verification checklist

- [ ] Rust: candidate clipping, invalid/empty rectangles, parent IDs, limits, negative origins, data-only metadata.
- [ ] Windows: native window enumeration snapshot and bounded child traversal; invalid/minimized/self windows filtered.
- [ ] macOS: both architectures compile bridge/FFI, candidate memory is freed and native fixture tests pass.
- [ ] JS: occlusion precedence, native child ancestry, Tab cycling, click jitter vs drag, reversed drag, bounds, DPI 1/1.5/2, missing metadata.
- [ ] Headless E2E: hover dashed bounds and spotlight, click capture, drag override, manual-only mode, Escape/right cancel, HUD interactions, stale sessions, four languages, magnifier at edges.
- [ ] Native IPC smoke: new metadata serializes correctly and invalid sessions still reject without revealing windows.
- [ ] Full existing JS/component/E2E/Rust regression; formal Windows build and Mac CI.
- [ ] Original running app/data untouched during development. No Computer Use or OS mouse/keyboard injection.

## Limits to state accurately

These are window/native-control rectangles, not AI vision segmentation or browser DOM inspection. Web-page cards and custom-drawn UI may expose only a larger native surface; use Tab or manual drag for precision. Mac child-control discovery would require a separate Accessibility design and is not silently requested here. Mixed-DPI physical pointer operation and Mac capture permission/Retina behavior remain hardware verification items.
