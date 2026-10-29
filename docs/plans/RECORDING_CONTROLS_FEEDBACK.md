# 錄影互動與完成回饋

日期 2026-10-30；分支 codex/recording-controls-feedback。

參考 ShareX 的 RecordingRegionBorder.Render、ScreenRecorderBarWindow.PositionNearRegion/ClampToScreen、ScreenRecorder 暫停/繼續/停止、RecordingClock 及 CaptureBase 成功音效。獨立重作，不複製 GPL 程式或音效。

| 需求 | 設計 | 驗證 |
|---|---|---|
| 錄影範圍 | 綠色原生虛線，暫停變黃，置頂且滑鼠穿透 | 實際視窗、色彩像素與邊界幾何 |
| 控制列 | 停止/暫停或繼續/取消、HH:MM:SS；定位在選區附近 | 語義化 E2E 與真實 WebView 截圖 |
| 不錄入自身 UI | 外框位於擷取範圍外；兩視窗設 WDA_EXCLUDEFROMCAPTURE | 實際 affinity 與輸出檢查；失敗時拒絕開始 |
| 真正暫停 | 結束片段並停止擷取，繼續產生新片段後串接 | 計時凍結、原生操作與解碼/時長 |
| 取消 | 丟棄片段，不加素材，不播放完成音 | 原生素材數不變、cancelled、視窗隱藏 |
| 完成音效 | 自製 WAV，保存成功後 Windows PlaySound 非同步播放 | WAV、分支及原生 API；聽感需人耳驗收 |
| 保留資料 | 原有鍵位、短句、設定、草稿 | 檔案 hash 與記憶體狀態比對 |

不使用 Computer Use 或桌面輸入注入。Headless Chromium 測 UI；內部 CDP/IPC 驗證隔離 Tauri。仍為 Windows 無聲 WebM/GIF，不宣稱包含 ShareX 全部音訊、攝影機或編輯功能。
