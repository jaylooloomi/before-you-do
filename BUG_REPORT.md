# 缺陷報告

2026-10-25：經使用者授權修正，以下兩項已修復；原先的重現證據保留供追溯。測試環境：Windows、Chromium headless、Tauri IPC 測試替身；原生 storage/roles 真實隔離檔案。

## BUG-001 — 管理頁／picker 初始化 IPC 拒絕無錯誤處理（已修復）

- 嚴重度：中；系統錯誤時可能留下半成品畫面。
- 原始重現：IPC `picker_state`／`get_snippets` reject `error.read`；修正前 E16／E04 產生紅燈。
- 正常預期：可理解的錯誤訊息／恢復方式，沒有未捕捉 Runtime Error。
- 修正前位置（main 6219ba1）：src/main.js:97、313，頂層 await 無 catch；目前修正入口為 src/main.js:18 的 startApp 與339的錯誤處理。
- 實際 Console/PageError：`pageerror: error.read`，全域 fixture 另以 `Zero console/page errors` 判失敗；畫面無可理解的錯誤訊息。
- 截圖／DOM snapshot／trace：`artifacts/qa/bugs/BUG-001/`，管理頁另在 `artifacts/qa/bugs/manager-startup/e2e/manager-E04-bug-manager-st-31a0a-d-show-recoverable-error-UI/`。
- 修正：`src/main.js` 將啟動鏈集中於 startApp，catch 顯示四語 role=alert、實際錯誤與重新載入按鈕；未完成初始化的根節點 inert，禁止誤編輯或儲存。正常操作不走此路徑。
- 回歸：E04／E16 取消 fixme，固定模擬失敗，確認錯誤提示、清除故障後按重新載入恢復正常畫面；全域 console/page error 必須為零。

## BUG-002 — Unicode 長度契約不一致（已修復）

- 嚴重度：中；含大量 emoji 的合法原生資料無法被 UI 匯入／重新儲存。
- 重現：100 個 😀 作 name，Rust `storage::validate` 接受；JS `parseSnippetImport` 應接受同一資料，卻拒絕。
- 正常預期：前後端使用相同字數定義。不是要求固定選 UTF-16 或 codepoint，而是必須一致。
- 位置：src/model.js:7、38、61 使用 `.length`；src-tauri/src/storage.rs:24、30–31 使用 `.chars().count()`；UI maxlength 也使用 UTF-16。
- 自動化：src-tauri/tests/qa_storage.rs B06 原生正向 fixture + tests/qa-contract.test.js 缺陷斷言。
- 真實失敗：`error.import_entry`，params `{index:1,field:'name',reason:'error.import_length',limit:100}`；文字紀錄 `artifacts/qa/bugs/BUG-002.txt`。這是純資料契約缺陷，沒有適用的前端失敗截圖或 Console Error。
- 修正：`src/unicode.js` 的 characterCount 以 codepoint 計數，供 model 的匯入、草稿驗證、儲存與畫面字數共用。移除使用UTF-16計數的HTML maxlength，超限由原有欄位驗證呈現；未截斷或重寫既有內容。
- 回歸：Node契約測試取消skip；三欄各測上限與多一個emoji；Rust對應同樣邊界；瀏覽器實際填入100/20000/1000個emoji後儲存與重整，驗證完整資料及超限保留舊已存值。

## 非缺陷但未通過驗收的邊界

- 390px 手機小於原生 minWidth=780，僅作觀測，不能視為支援手機；原生跨程序貼上、OS 快捷鍵、macOS 實機不由瀏覽器 IPC double 證明。
- Rust LLVM coverage 已嘗試 instrument-coverage，工具鏈報 `can't find crate for profiler_builtins`；這是量測環境限制，不是產品缺陷。
