# 全端測試矩陣

基準 main 6219ba1。`[x]` 實際通過、`[!]` 有可重現產品缺陷；N/A 必須具體說明。測試實作前建立本矩陣。

## Backend

- [x] B01 | Backend | storage | 驗證／boundary | 空陣列、101筆、空白與長度上限 | 拒絕，原檔不變。
- [x] B02 | Backend | storage | integration | 儲存→修改→備份→載入 | 正文/情境/順序一致，backup 是上一版。
- [x] B03 | Backend | storage | resilience | corrupt/BOM/legacy、stale snapshot、刪檔 | 錯誤不覆寫；有效 BOM 可讀。
- [x] B04 | Backend | roles | isolation | 白名單／路徑穿越／切角色／已知刪檔 | 各檔隔離，不重建被刪資料。
- [x] B05 | Backend | picker/shortcut | states | begin/navigate/commit/cancel/repeat/add/settings | 正確文本快照與一次性提交，不實際注入 OS 輸入。
- [x] B06 | Backend+FE-Unit | Unicode contract | boundaries | 同一 emoji 名稱分別經 JS 與 Rust 驗證 | 契約應一致；不把差異寫成正常預期。

## FE-Unit／Component

- [x] C01 | FE-Unit | model/search/i18n | validation | 跑所有既有邏輯測試與覆蓋率 | partial save、roles、4語、搜尋、匯入匯出通過。
- [x] C02 | FE-Unit | dialog | happy/validation/navigation | 真實元件掛載、確認/取消/Esc、焦點、script 字串 | 正確 Promise、焦點復原、無執行注入。
- [x] C03 | FE-Unit | settings | happy/async/error | 掛載元件；複製連點、IPC 拒絕、完成解鎖 | 單一請求、disabled、成功/錯誤可見。
- [x] C04 | FE-Unit | settings/import | validation | 非法 JSON、有效 JSON、取消 | 無效不呼叫 onImport；有效依確認結果處理。

## FE-E2E：管理頁六維度

- [x] E01 | FE-E2E | manager | happy | 新增名稱/內容/情境→儲存→重整 | 已存內容與情境保留。
- [x] E02 | FE-E2E | manager | validation/XSS | 空正文草稿、script/SQL 字串、搜尋 | 草稿不入已存資料、注入不執行、錯誤可定位。
- [x] E03 | FE-E2E | manager | async/empty | 延遲儲存連點；空清單→新增 | 單次請求，忙碌時不可編輯，空態可恢復。
- [x] E04 | FE-E2E | manager | error | IPC save/switch 拒絕 | 顯示錯誤，保留輸入，畫面可再次操作。
- [x] E05 | FE-E2E | manager | navigation | 切角色再回來、取消刪除、history/query、refresh | 角色草稿保留；已存資料重整維持；無登入/401守衛（N/A）。
- [x] E06 | FE-E2E | manager | viewport/a11y | 1920×1080、780×680、390×844 | 桌面儲存按鈕可點無遮擋；390小於原生最小780需記錄實際結果與適用邊界。

## FE-E2E：設定頁六維度

- [x] E07 | FE-E2E | settings | happy | 複製JSON/AI指令、匯入確認、reload、範本 | 正確範圍/內容，導覽回管理頁一致。
- [x] E08 | FE-E2E | settings | validation/XSS | 格式/型別錯誤、極長、script 名稱 | 不儲存無效資料，確認文字安全。
- [x] E09 | FE-E2E | settings | async | hold copy IPC、連點複製 | disabled 防連點；完成恢復；匯入確認與取消另見C04/E07/E08。
- [x] E10 | FE-E2E | settings | error | copy/reload/save_shortcut 拒絕與可控 pending | 錯誤可見、按鈕恢復；無 HTTP/Token timeout 契約，直接測 IPC 邊界。
- [x] E11 | FE-E2E | settings | navigation | 四語→refresh→返回、history | UI語言保留，使用者短句不翻譯。
- [x] E12 | FE-E2E | settings | viewport/a11y | desktop/min/mobile、標籤、modal keyboard | 主要操作可達，dialog 可 Esc 取消。

## FE-E2E：picker 六維度

- [x] E13 | FE-E2E | ?picker | happy | 原生狀態事件→角色/短句/Add/Settings | 正確渲染；至少3列可見。
- [x] E14 | FE-E2E | ?picker | validation/XSS | script名稱、長正文、情境字串 | 原文安全呈現，無script執行。
- [x] E15 | FE-E2E | ?picker | async/empty | []與連續快照事件 | Add/Settings仍可見，更新不重複列。
- [x] E16 | FE-E2E | ?picker | error | picker_state IPC拒絕 | 應有可理解錯誤回饋，無未捕捉錯誤。
- [x] E17 | FE-E2E | ?picker | navigation | role event/query/history/reload | 正確角色與view；原生左右鍵/放開貼上屬B05及原生驗收邊界。
- [x] E18 | FE-E2E | ?picker | viewport/a11y | 580×480、390×844、1920×1080 | 列與footer無遮擋；document語言正確。

所有 E2E：全域監聽 console.error/pageerror，錯誤即失敗；兩項缺陷已修復，原缺陷案例取消skip/fixme並納入正常回歸。禁止固定 sleep、class selector、XPath。路由覆蓋以3個view為分母，非HTTP endpoint數。

## 執行結果與證據

B06 對應已修復的 BUG-002；E04/E16 啟動 IPC 拒絕對應已修復的 BUG-001。原先紅燈證據保留，目前取消略過，驗證錯誤提示、重新載入恢復與Unicode三欄完整保存。其餘項目由 tests/*.test.js、tests/components/、tests/e2e/、src-tauri/tests/qa_storage.rs 與既有 Rust unit tests 覆蓋。

E06/E12/E18 已產出各尺寸截圖；390px 小於原生780最小寬，僅觀察，不列為行動版驗收通過。原生框線、焦點、跨程序貼上與 Mac 仍需原生驗收。
