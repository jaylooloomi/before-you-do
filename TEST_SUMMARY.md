# 全端品質與驗收報告

基準：main 6219ba1；2026-10-25；Windows，首次QA維持產品唯讀；後續已獲使用者授權修正兩項缺陷，未新增 data-testid，未操作正式 App 或正式資料。

## 驗收結論

兩項已知缺陷均已修復，原skip/fixme已取消並納入正常回歸；紀錄見 [BUG_REPORT.md](BUG_REPORT.md)。初始化失敗會顯示可恢復的錯誤畫面；Unicode計數與Rust一致。驗收限於已測範圍，不代表不存在其他缺陷。

## 一鍵執行

首次準備（Node、Rust/Windows MinGW 必須可用；repo 的 `.tools` 存在時 runner 自動採用）：

```powershell
npm ci
npx playwright install chromium
# 新機須先下載 Rust 依賴；後續測試本身離線且不連正式資料。
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npm run test:qa
```

`test:qa` 連續執行兩輪 Node → Component → Rust → E2E，任何未預期失敗傳回非零。Playwright webServer 自動啟閉 Vite 5187，不共用使用中的 server。headless，無固定 sleep，使用語義定位，每個案例收集 console.error/pageerror，出錯必敗；trace 保留失敗，失敗自動截圖。成功布局截圖也有保留。

分層指令：

```powershell
npm test
npm run test:components
npm run test:e2e
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml
node scripts/qa-audit.mjs
```

單獨執行修正回歸：

```powershell
npx playwright test -g "startup|Unicode"
node --test tests/qa-contract.test.js
```

## 測試清單與架構範圍

見 [TEST_MATRIX.md](TEST_MATRIX.md)、[逆向盤點](docs/qa/RECONNAISSANCE.md)。產品沒有 HTTP API、Token/登入、DB 或 SPA Router，未捏造401/403/404測試；改測實際 IPC 的拒絕、延遲、連點防護與畫面恢復。3/3 view 已走訪：manager、同頁 settings、`?picker`。這是 view coverage，不等於所有 IPC 指令／所有原生平台行為100%。

|層級|每輪正常回歸|限制|
|---|---|---|
|Node 邏輯|37 passed，0 skipped|既有31項＋2項Unicode契約與4項語系保護測試|
|Vitest Component|6 passed|真正 settings/dialog 元件；jsdom 模擬 dialog API，瀏覽器另測原生 dialog|
|Rust Unit|21 passed，1 ignored|ignored 會註冊真實系統快捷鍵，避免干擾|
|Rust Integration target|15 passed|4新增案例＋引用產品模組時重跑11個既有測試，不能當成15個全新測試|
|Chromium E2E|27 passed，0 skipped／fixme|真實前端＋明示 IPC double，並非原生 Tauri 全鏈路|

每輪共106個通過執行、1個系統快捷鍵測試ignored；去掉Rust重複11例後是95個獨立通過案例。原缺陷測試現在正常執行。

## 覆蓋率審計

|量測範圍|結果|證據／解讀|
|---|---|---|
|Node 實際載入模組|line 92.35%、branch 87.63%、functions 88.33%|`artifacts/qa/run-*/node.log`；不包含未載入的 DOM orchestration|
|Vitest 全 src JS（排除locale資料檔）|line 31.28%、statement22.94%、branch19.89%、function24.45%|`run-*/component-coverage/`；不能用 Node 的92%冒充全前端覆蓋率|
|settings.js Component|line90.62%、branch66.66%|仍有快捷鍵與範本分支主要靠E2E|
|dialog.js Component|line100%、branch69.23%|notice等分支尚未全覆蓋|
|Browser view coverage|3/3＝100%|每個view均有六維度案例；E04/E16包含啟動失敗提示與恢復流程|
|Browser JS|原始V8覆蓋資料已隨各案例附檔|尚未轉換合併成source-mapped line coverage；不報虛構百分比|
|Rust code coverage|**未取得**|已安裝llvm-tools並嘗試 `cargo rustc --test qa_storage -- -C instrument-coverage`，toolchain缺`profiler_builtins`；Unit/Integration仍真實通過|

不足：Rust未量測、Component分支覆蓋率低，不能認定「全端完全覆蓋」。後續可用含 profiler runtime 的 CI toolchain 量測，並補齊尚未執行的原生 IPC command/window/macOS 分支；本次只依授權修正已確認缺陷，未為提高數字修改其他產品邏輯。

## 畫面與自動化邊界

- 管理頁1920×1080與原生最小780×680：儲存按鈕真實 actionability 檢查通過；settings主要操作可捲達；picker580×480可見三列＋Add/Settings。
- 390×844有截圖觀測；小於原生 minWidth780。管理頁不宣稱支援手機；這不是把不可用手機布局寫成正常支援。
- 已人工查看無頭截圖 manager780與picker580。瀏覽器截圖無法驗證 OS 白框、玻璃、DWM圓角、真實焦點、跨程序貼上。
- 原生Alt+H hook狀態由既有Rust單元覆蓋；瀏覽器只驗證管理頁按鍵dismiss IPC與picker事件渲染。沒有向桌面注入輸入、沒有測試或改動使用者剪貼簿。
- 未執行 legacy `tests/native-save-workflow.mjs`／C#桌面測試，避免接到使用中的正式App。未啟動預覽App。

## 可追溯產物與執行狀態

最終兩輪8個分層執行退出碼全部0，E2E各27通過／0fixme／0 unexpected／0 flaky／0 console errors；時間以COVERAGE_AUDIT.json的UTC時間為準。兩輪完整回歸與 zero-flake 審計：`artifacts/qa/runs.json`、`artifacts/qa/audit.json`，另持久化精簡版本至 [REGRESSION_RUNS.json](docs/qa/REGRESSION_RUNS.json) 與 [COVERAGE_AUDIT.json](docs/qa/COVERAGE_AUDIT.json)；分輪 Node/Component/Rust/E2E log 與 HTML 報告位於 `artifacts/qa/run-1/`、`run-2/`。失敗重現獨立保留於 `artifacts/qa/bugs/`，避免被正常回歸清掉。

基建開發期間有 selector、inert判斷、init script順序、Windows PATH/清理問題；均修正測試基建，沒有改產品或把這些當產品Bug。最終兩輪的具體退出碼以runs.json為準。兩輪通過只代表這兩輪沒有觀測到flaky，不保證永遠零競爭。

測試依賴皆 devDependencies，沒有新增runtime依賴。Windows正式Tauri建置 `npm run build -- --no-bundle` 通過，輸出位於 src-tauri/target/release/before-you-do.exe，未替換正在執行的根目錄App。未修改CI、未發版或重啟App；測試與修正提交並推送至main。本次交付包含兩個產品缺陷修正與原測試取消略過。


內建提示詞隨語系切換的追加規格與保護方式見 [SNIPPET_LANGUAGE.md](docs/qa/SNIPPET_LANGUAGE.md)。
