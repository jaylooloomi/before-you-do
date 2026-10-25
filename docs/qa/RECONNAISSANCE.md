# Phase 1：架構逆向盤點

盤點基準：main 6219ba1，2026-10-25。首次盤點保持產品原始碼唯讀；後續使用者授權修正兩項缺陷，詳見 BUG_REPORT.md。測試不連正式 App、不使用 Computer Use。

## 啟動鏈路

- `npm run dev` → Tauri CLI → `npm run dev:ui` (Vite 127.0.0.1:5173) + Rust desktop process。
- `npm run build` → generate-role-defaults + Vite → Tauri 原生包裝。
- 無獨立 HTTP 後端、DB、Axios、認證、Cookie Token、401/403 或管理員路由。
- 原生後端：Tauri 2、serde/serde_json、quick-xml、arboard、Windows API；macOS 另有平台實作。

## 前端拓撲

|入口／view|狀態與操作|安全邊界|
|---|---|---|
|`/` manager|12 角色、搜尋、短句 CRUD、情境、排序、部分儲存、草稿與退出確認|全為本機使用者操作|
|同頁 settings|快捷鍵、四語、範本、資料路徑、AI 指令、JSON 匯入匯出、重新載入|DOM hidden 切頁，無 Router|
|`/?picker`|角色與短句快照、Add/Settings 列、選取提示|鍵盤選取由原生事件驅動，瀏覽器測試不能證明 OS 貼上|
|其他 query / history|只有 `picker` query 決定 view；無 404 或權限頁|桌面非網站，不應虛構登入測試|

`src/main.js` 為 DOM orchestration；`settings.js`、`dialog.js` 為可獨立測試的 DOM 元件。無 React/Vue/store。角色草稿存在 Map，重新整理不承諾復原；localStorage 存 `quicksay.language`、`quicksay.appearance`，storage event 同步多 WebView。原生 JSON 存已儲存內容及快捷鍵、角色選擇，`.json.bak` 為上一版。

表單：name 100、text 20000、scenario 1000；1–100 筆；Unicode 前後空白；JSON 型別檢查。排序在搜尋時禁止。刪除／匯入／重新載入／退出使用 app-owned dialog；有效短句可與未完成草稿分別儲存。

## 後端 IPC 與儲存

`main.rs` command 清單：set_ui_language、preview_picker、get_shortcut、save_shortcut、get_role、switch_role、get_snippets、save_snippets、storage_info、copy_text、open_data_folder、reload_snippets、picker_state、consume_new_snippet、consume_open_settings、native_status、restart_keyboard、dismiss_manager_shortcut、hide_manager、window_action、configure_glass、request_quit、confirm_quit、preview_quit_approved。

- storage.rs：驗證、BOM/legacy XML 載入、snapshot 比較、temp+sync+backup+rename 儲存。
- roles.rs：固定白名單、檔名隔離、記憶角色、已知刪檔保護。
- shortcut.rs/platform：快捷鍵驗證、持久化、原生 hook、repeat/cancel/commit 狀態。
- 外部邊界：OS 剪貼簿、檔案總管、玻璃效果、window/tray、跨程序貼上。測試須隔離或 mock；不使用正式 APPDATA。

## 測試工具與誠實限制

既有31項 Node +20項 Rust 測試並非「完全沒有測試」；缺的是完整規格、統一基建與瀏覽器回歸。新增 Vitest/jsdom/Testing Library、Playwright；保留既有 Node runner。瀏覽器以測試專用 Tauri IPC adapter 啟動真正前端，非原生 E2E；Rust integration 直接引用唯讀模組並用 temp directory 驗證真實檔案。所有瀏覽器案例捕捉 console.error/pageerror。Rust coverage 若工具不可用需明載，不以測試數冒充覆蓋率。
