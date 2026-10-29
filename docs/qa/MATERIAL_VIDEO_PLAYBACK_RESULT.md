# 素材區影片播放

2026-10-30；分支 codex/material-video-playback；實作 a063f8d。

既有 kind=file 的 WebM 錄影及 MP4 附件直接顯示 HTML video controls，不遷移資料、不自動播放。支援播放／暫停、進度跳轉及音量；格式／編碼不支援或 IPC 失敗時顯示匯出提示。後端只讀取目前素材清單中的受管理檔案，依容器簽名判斷 MIME，不以副檔名直接信任內容。CSP media-src 只開放 self/data。

## 驗證

- npm test：54 通過；元件 15 通過；全 src 行覆蓋率 35.84%，不含 node:test/E2E。
- Playwright 全套：65 通過，0 skipped/flaky，console.error/pageerror 全域攔截。
- Rust：51 unit + 16 integration 通過；1 個既有 Alt+H 註冊測試為 opt-in ignored。新增容器辨識／偽裝與截斷檔案拒絕測試。
- 正式 Windows build 成功。
- node scripts/test-native-material-video.mjs：隔離、隱藏的真實 Tauri WebView 解碼 VP8/Opus WebM 128×72；播放時間前進、暫停、seek 至 1.1 秒、音量 0.35、無自動播放均通過。素材前後完全相同，0 Runtime Error、0 可見測試視窗、無桌面輸入或剪貼簿操作。測試時靜音。
- 原生畫面證據 artifacts/native-material-video-1793303172600/native-video-player.png 已查看，合成影片 fixture 不含實際桌面內容。

## 已開啟新版

原本程序正常退出後，正式根目錄 App 已替換、啟動為 PID 80832，開到素材頁並將既有影片播放器捲到可視範圍。原本一筆 WebM 已實際讀到 metadata、正確尺寸，controls=true、paused=true；沒有替使用者自動播放。

私人備份在忽略的 .tools/upgrades/material-video-20261030/。所有原有檔案 SHA-256、六組記憶體角色／版本基線／草稿旗標、localStorage、素材及設定均保留。原有 Ctrl+Shift+F6～F10 五鍵仍註冊成功。全程未使用 Computer Use、桌面鍵鼠注入或系統剪貼簿。沒有合併 main 或發布 Release；MP4 能否解碼取決於平台 WebView 的 codec，失敗時可匯出。
