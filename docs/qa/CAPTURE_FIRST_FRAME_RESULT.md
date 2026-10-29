# 區域截圖首幀修正驗證

2026-10-30；分支 codex/capture-first-frame；實作 1d373ad。

## 結果

圖片解碼、初始游標與放大鏡先準備好，覆蓋視窗以 alpha 0 暖機；兩次 RAF 與 Windows DwmFlush 後才顯示完整內容並取得焦點。放大鏡不再依賴首次 pointermove；使用者關閉偏好仍保留。Windows 覆蓋層統一使用原生顯示／隱藏，避免 Tao 的 VISIBLE 快取令透明度重設或取消無效。macOS 增加 Apple SDK 游標／視窗 alpha 橋接；實機仍待驗證。

| 驗證 | 實際結果 |
|---|---|
| npm test | 54 通過 |
| npm run test:components | 15 通過；全 src 行覆蓋率 36.06%，不包含 node:test／E2E |
| Playwright 全套 | 63 通過，0 skipped、0 flaky；console.error/pageerror 全域攔截 |
| Rust | 50 unit + 16 integration 通過；1 個既有 Alt+H 原生註冊測試維持 opt-in ignored |
| 正式 build | npm run build -- --no-bundle 成功 |
| 原生首幀 | node scripts/test-native-capture-presentation.mjs 通過三輪及載入途中取消 |
| 原生舊 IPC | node scripts/test-native-capture-ipc.mjs 通過，0 可見測試視窗、0 Runtime Error |

原生首幀測試在獨立 --design-preview --autostart --capture-presentation-test 實例執行。測試閘門只供明確啟用的 preview 使用：阻擋圖片解碼時，實際原生視窗保持隱藏；阻擋 present 時，實際視窗 alpha=0、已完成桌面／放大鏡繪製且不啟用測試程式。解除閘門才變成 alpha=255。三個 session 均通過，游標圖片座標 [2579,406]，未注入任何 pointermove。取消時晚到的解碼亦不能重新開窗。

證據位於忽略的 artifacts/native-capture-presentation-1793302664719/，包含每輪 prepared/visible PNG、原生透明度 JSON 與 result.json。已透過圖片檢視器查看 cycle-0-visible.png，確認真實桌面內容、虛線範圍及游標旁放大鏡；不是只查視窗資料。真實桌面可能包含使用者內容，不加入 Git。Headless 合成圖片證據另存 artifacts/capture-first-frame.png。

測試也暴露並修正初始游標在 CSS／圖片縮放 round-trip 時差一像素的 ULP 誤差，以及混用 Tao／原生 show-hide 導致取消失效的問題；沒有把這些失敗寫成正常預期。

## 啟動與資料保留

已正常關閉舊版，將正式 build 複製至根目錄 before-you-do.exe，啟動 PID 79244，開到素材頁。執行檔 SHA-256 與 build 相同。私人備份位於忽略的 .tools/upgrades/capture-first-frame-20261030/。

所有原有磁碟資料 hash、六組記憶體角色狀態、草稿旗標、版本基線、localStorage、素材與額外設定輸入均核對保留。原有 Ctrl+Shift+F6～F10 五鍵仍註冊成功，Alt+H 及 ShareX 均未修改。沒有強制儲存短句草稿，也沒有使用 Computer Use、桌面鍵鼠注入或系統剪貼簿。

跨平台 CI：https://github.com/jaylooloomi/before-you-do/actions/runs/40942069038 （報告時仍在執行，不視為通過）。原生 IPC／畫面閘門驗證不是實體按鍵或高速攝影；Mac 實機首幀、混合 DPI 的實際指標操作仍待硬體驗收。沒有合併 main 或發布 Release。
