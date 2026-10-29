# 智慧區域截圖驗證

日期：2026-10-30。分支：codex/smart-region-capture。實作：777bd4a。

## 實作與研究

研究 ShareX 的 WindowsRectangleList、RegionCaptureWindow、RegionSelectionOverlay 與 RegionCaptureOptions；參考版本及獨立設計見 ../plans/SMART_REGION_CAPTURE.md。沒有複製或打包 ShareX 的 GPL 程式碼。

採用凍結桌面與候選矩形樹：先命中最前方視窗，再往原生控制項遞迴，避免背後視窗的小區域搶走選取。小幅手震仍視為單擊，移動達 4 CSS 像素改為手動拖曳。Tab 可切換父層。外圍變暗、選取區保持明亮，不啟用或改變底層應用程式焦點。放大鏡讀取同一張凍結圖片，沒有持續重新截圖。

## 已執行結果

| 驗證 | 結果 |
|---|---|
| npm test | 52 通過 |
| npm run test:components | 15 通過 |
| Playwright 全套 | 50 通過，0 skipped、0 unexpected、0 flaky；全域監聽 console.error/pageerror |
| Windows Rust | 43 unit + 16 integration 通過；1 個既有熱鍵註冊測試維持 opt-in ignored，避免干擾使用者 |
| npm run build -- --no-bundle | 正式 Windows 執行檔建置成功 |
| 原生擷取 audit | 3840×1080、桌面原點 (-1920,0)；38 個根視窗、147 個候選區域，所有 bounds/parent/group 驗證通過；裁切、保存、匯出通過 |
| node scripts/test-native-capture-ipc.mjs | 真實 Tauri IPC、過期 session / 無效模式拒絕、隔離保存/匯出通過；0 Runtime Error、0 可見測試視窗 |
| 跨平台 CI | Windows、Apple Silicon Mac、Intel Mac 全部成功；Release job 按分支規則略過 |

CI：https://github.com/jaylooloomi/before-you-do/actions/runs/40925717251

新增 6 個純邏輯及 5 個智慧截圖 E2E 測試，涵蓋遮擋順序、父層切換、單擊/拖曳門檻、反向拖曳、無 metadata fallback、倍率 1/1.5/2、放大鏡像素與邊界、工具列、語言及取消。E2E 截圖 artifacts/smart-region-hover.png 使用合成測試圖片；已查看虛線、明暗區及放大鏡，並修正工具列文字對比。測試圖片不能代替實體桌面互動驗收。

元件測試的全 src 行覆蓋率為 34.33%；此數值不包含 node:test 與 E2E，不能視為整套功能覆蓋率。

## 資料與驗證界線

全程未使用 Computer Use、桌面輸入注入或系統剪貼簿。原生測試使用隔離素材目錄；沒有改動使用者短句、設定或記憶體草稿，也沒有終止目前執行中的正式版本。新版執行檔位於 src-tauri/target/release/before-you-do.exe；尚未替換執行中的根目錄版本、合併 main 或發布 Release。

Windows 偵測原生 HWND 控制項；macOS 只偵測視窗，不要求 Accessibility。網頁自繪卡片不是原生控制項。Windows 混合 DPI 的實際滑鼠框選、Mac TCC/Retina 與實機操作仍待人工驗證；CI 包含橋接 ABI/記憶體及原生影像 fixture，不能取代上述硬體驗收。
