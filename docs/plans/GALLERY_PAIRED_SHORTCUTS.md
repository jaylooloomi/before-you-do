# 功能與快捷鍵配對、縮圖素材庫、停止音效比較

日期：2026-10-31。分支：codex/swiss-workspace-layout。

## 布局

1. 素材仍在中央，改為 ShareX 式網格：桌面 3 欄左右，窄視窗自適應 2／1 欄；檔名在縮圖上方，圖片／影片／文字／檔案都使用一致卡片。
2. 每張素材卡右上角提供小 × 移除。縮圖選取連動右側預覽，影片有真正可用的播放入口；不以靜態圖片取代播放器。
3. 拖曳把手負責素材排序，不攔截文字編輯與影片控制；保留收合的上下移排序作為鍵盤替代。排序不改變素材內容或選取 ID。
4. 展開「擷取與快捷鍵」：五列逐項對應「區域截圖按鈕＋區域快捷鍵」、「全螢幕按鈕＋全螢幕快捷鍵」、「視窗按鈕＋視窗快捷鍵」、「錄影按鈕＋錄影快捷鍵」、「GIF 按鈕＋GIF 快捷鍵」。快捷鍵仍批次儲存，衝突保留輸入。
5. 原本快速工具列保留，配對列使用同一套動作與 busy／權限／錄影狀態，不重複註冊快捷鍵。

## 音效

- 追查本機 ShareX ScreenRecordManager → NotificationSound.ActionCompleted → ActionCompletedSound.wav。
- 與本 App src-tauri/assets/recording-complete.wav 比較 SHA256、PCM 格式、長度、峰值、RMS；提供原檔試聽，不自動播放或修改設定。
- 不把 ShareX 音效直接併入 MIT 發佈資源；來源與 GPL 授權資訊保留在報告，本輪僅作本機比較。

## 保護與測試

- 不使用 Computer Use，不關閉使用中的 App、不改短句／設定／草稿。
- 測試配對列、對應動作、防連點、權限／錄影狀態、快捷鍵衝突、四語。
- 測試圖片／影片／文字／檔案網格、拖曳與鍵盤排序、移除、匯出、草稿不變及失敗復原。
- Headless 截圖檢查桌面／窄視窗、四語／深色；所有 E2E 攔截 console/pageerror。
- 執行 unit／component／完整 E2E／正式 build 與隔離原生播放／IPC 驗證。

驗收完成；結果與實際截圖見 docs/qa/GALLERY_PAIRED_SHORTCUTS_RESULT.md；音效比較見 docs/qa/STOP_SOUND_COMPARISON.md。
