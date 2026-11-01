# Material workspace and saved packs

Current materials form a workspace separate from saved material packs. Capture, type, attach, reorder and paste without naming a task. The workspace and text drafts persist locally. Alt+M and Alt+V operate only on this workspace.

## Actions

- **Save material pack:** one click creates an independent snapshot named with local time, such as `素材包 20261101-153045`. Same-second collisions add `-02`, `-03`, etc. Existing names stay unchanged. No name dialog. Failed saves leave committed data unchanged.
- **Load material pack:** shows name, saved time when known, and material count. The wide selector shows the saved pack name; count and saved time appear below. The dialog has Cancel, Delete, Add and Replace buttons. Add appends independent copies; Replace replaces current materials after confirmation and leaves the saved pack unchanged.
- **Clear:** confirms before clearing only the workspace. Saved packs and exports stay unchanged.
- **Undo clear:** restores cleared items and retains new items added since clearing. Undo survives restart. The existing 100-item / 100-MB limits apply; overflow refuses without discarding either set.
- **Delete:** confirms before removing the selected saved pack. Current materials, undo and numbering remain intact, including after deleting the last pack.

## Existing data and migration

Schema version 2 separates the workspace, saved packs, undo and serial counter. Existing packs retain names, order and contents. The old active contents become the workspace with their original IDs, so pending drafts still match; an independent copy remains in the library. Empty legacy placeholders remain on disk but are hidden from the Load list.

Before migration commits, the exact prior session bytes are preserved in `prompt-materials/session.pre-workspace.json`. Original assets remain in place. Snapshot and load actions create independent asset copies. Copy or session-write failure removes new copies and preserves committed state. Older builds reject version 2 instead of silently removing these fields. Back up before upgrading or downgrading.

Active legacy text drafts are transferred to the workspace recovery key; old keys remain available. Snippet drafts, role settings and shortcuts stay separate.

## Verification

Rust tests cover migration backup bytes, snapshot independence, persistent serials, restart, clear/undo with new items, Add/Replace, asset isolation, write rollback, missing targets and size limits. Browser tests cover one-click save, no naming prompt, pending-action protection, failed saves, load confirmation, deletion and cancellation, legacy draft recovery and original snippet preservation.

## 中文操作

直接整理「本次素材」→ 貼給 AI → 清空。要重複使用才按「儲存素材包」，自動帶流水編號，不必命名。「載入素材包」只有取消、刪除、加入、取代四個按鈕；刪除只移除選取的已存素材包，載入前會確認取代本次素材。清空不影響已存素材包，且可復原；Alt+M／Alt+V 只處理本次工作區。
