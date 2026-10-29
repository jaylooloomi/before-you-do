# 截圖快捷鍵與錄影

分支：codex/capture-hotkeys-recording；日期：2026-10-30。

## 需求與界線

移除框選時的大型工具列，保留虛線、尺寸及放大鏡。設定移到素材頁。保持 Alt+H、短句、設定及草稿相容；不使用 Computer Use 或桌面輸入注入。

Windows 新增可調整的五個全域鍵：Shift+PrintScreen 區域、PrintScreen 全螢幕、Alt+PrintScreen 視窗、Ctrl+Shift+PrintScreen 影片、Ctrl+Alt+Shift+PrintScreen GIF。留空停用，可用 F6–F12 替代；衝突顯示，不默默接管。再次按錄影鍵停止。系統匣另有停止選項。快捷鍵截圖後不彈出管理視窗。

## ShareX 研究

參考 temp/ShareX 的 ScreenRecorder.cs、RecordingOptions.cs、RecordingClock.cs、Video/GraphicsCapture.cs、Encoding/MediaFoundationWriter.cs、Encoding/GifWriter.cs。ShareX 將選區、擷取、時鐘、停止後封裝分開，Windows 原生 GPU/MediaFoundation 與 GIF 編碼不是區域截圖圖片的延伸。沒有移植 GPL 程式碼。

這次採獨立 FFmpeg LGPL shared 子程序，用 gdigrab 擷取已選的桌面區域，WebM VP8 15 fps、GIF 10 fps；不收音，最長 120 秒、素材單檔 25 MB。保留失敗/超限輸出的原始路徑供救援。FFmpeg 透過固定版本 URL 及 SHA-256 安裝，使用者按下安裝才下載，不改 PATH。Mac 的截圖維持原功能，錄影及新 PrintScreen 快捷鍵暫僅支援 Windows。

## 實作及驗收待辦

- [x] 無遮擋截圖、設定集中於素材頁、四語提示。
- [x] 快捷鍵解析、重複/非法鍵、停用、衝突及保存失敗回復。
- [x] 原生快捷鍵服務與 Alt+H 分離，重複輸入不建立平行工作。
- [x] 影片/GIF 框選、同鍵停止、系統匣停止、退出時先停止封裝。
- [x] 明確安裝元件、固定雜湊與第三方來源/授權紀錄。
- [x] 存入素材、排序/移除/匯出；失敗輸出保留，不覆蓋使用者檔案。
- [x] Rust 測試、JS/元件、全套 E2E、真實編碼及原生 IPC 停止驗證。
- [x] 正式 build、README 與測試報告、分支推送。
- [x] 如需替換執行版本，先獨立備份，驗證磁碟檔案及記憶體草稿。

實際滑鼠鍵盤操作、混合 DPI 指標、Mac 錄影不列為已驗證。

結果及實機驗證界線見 ../qa/CAPTURE_HOTKEYS_RECORDING_RESULT.md；Mac 錄影不在已完成範圍。
