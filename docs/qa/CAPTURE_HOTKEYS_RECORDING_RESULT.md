# 截圖快捷鍵與錄影驗證結果

日期：2026-10-30；分支 codex/capture-hotkeys-recording；主要實作 5ecc4eb。

## 實作

截圖不再顯示大型工具列，設定集中素材頁。新增獨立 Windows 全域快捷鍵服務，不調整 Alt+H。支援區域／全螢幕／視窗截圖，以及框選錄製無聲 WebM 和 GIF；同鍵或系統匣停止。快捷鍵擷取不彈出管理視窗。

使用固定 SHA-256 的 FFmpeg LGPL shared 元件；只有明確安裝才下載。錄製上限 120 秒、素材 25 MB，錯誤保留救援檔。錄製時系統匣紅點；退出先停止、等待封裝。Windows Job Object 確保 App 異常結束不留下持續錄影的編碼程序。參考與授權見 ../THIRD_PARTY_RECORDING.md。

## 已執行

| 驗證 | 結果 |
|---|---|
| npm test | 52 通過 |
| npm run test:components | 15 通過；全 src 行覆蓋率 36.78%，不包含 node:test／E2E |
| Playwright 全套 | 55 通過，0 skipped / flaky；全域 console.error/pageerror 攔截 |
| Rust | 46 unit + 16 integration 通過；1 個既有 Alt+H 原生熱鍵註冊測試仍為 opt-in ignored |
| 正式 Windows build | npm run build -- --no-bundle 成功 |
| node scripts/test-native-recording.mjs | 真實 gdigrab、VP8 WebM 160×120 與 GIF 160×120；ffprobe 驗證無音軌，FFmpeg 完整解碼成功；素材保存、GIF 預覽及匯出通過 |
| 同一原生 audit | 重複開始／錄影中截圖被拒絕，退出時停止封裝；原生快捷鍵註冊、停用、非法／重複鍵拒絕、真實外部註冊衝突與回復原設定通過；強制結束隔離 App 後編碼子程序消失 |
| node scripts/test-native-capture-ipc.mjs | 既有截圖能力、無效模式、過期 session、隔離資料保存／排序／移除／匯出通過；無可見測試視窗、Runtime Error 或桌面輸入 |

E2E 覆蓋無工具列、原有單擊／拖曳／Tab／取消、素材頁偏好、快捷鍵保存及失敗、明確下載防連點、錄製／停止／封裝狀態、救援路徑、不支援平台不影響文字。人工查看 artifacts/smart-region-hover.png，確認大型工具列已消失；此圖使用合成 fixture。

本輪原生測試曾暴露首次保存快捷鍵時資料夾不存在的問題，已加入父目錄建立後重跑通過。也修正安裝完成按鈕被舊 disabled 狀態覆蓋，以及快捷鍵衝突解除後提示未清除的 UI 問題。

## 本機使用者資料與快捷鍵

正常關閉舊版，使用正式根目錄執行檔啟動。私人備份存於忽略的 .tools/upgrades/recording-20261030/。核對所有原有資料檔案 SHA-256、六組記憶體角色狀態、版本基線、草稿旗標與 localStorage 設定均保留；沒有將草稿強制存成短句。

本機 Shift+PrintScreen 實際註冊衝突，ShareX 仍在執行。依使用者明確選擇保留 ShareX，將本機配置改為 Ctrl+Shift+F6／F7／F8／F9／F10，依序區域／全螢幕／視窗／影片／GIF，五個鍵已註冊成功；不更改 ShareX 或 Alt+H。這是本機使用者設定，儲存為獨立 capture-hotkeys.json，原有檔案不變。程式預設仍為 README 所列 PrintScreen 組合。

## 界線

Mac 仍保留截圖；新增錄影及 PrintScreen 全域鍵目前只支援 Windows。影片不收音，不含暫停、攝影機或 ShareX 全部編輯功能。實際按鍵／滑鼠流程與混合 DPI 操作未透過桌面輸入驗收；原生註冊及擷取／編碼已測，不能把它寫成實體按鍵測試。

全程未使用 Computer Use、桌面輸入注入或系統剪貼簿。沒有合併 main 或更新公開 Release。跨平台建置 CI：https://github.com/jaylooloomi/before-you-do/actions/runs/40931958481 （提交測試報告時仍在排程／執行；不得視為已通過）。
