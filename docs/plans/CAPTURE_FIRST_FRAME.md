# 區域截圖首幀與初始放大鏡

2026-10-30，分支 codex/capture-first-frame。保留使用者原有短句、設定、草稿與 Ctrl+Shift+F6～F10；不使用 Computer Use、桌面鍵鼠注入或系統剪貼簿。

## 原因

舊流程在 capture-ready 事件後立刻顯示黑底原生視窗，但前端尚未取回 PNG、解碼或繪製。放大鏡則依賴第一次 pointermove，沒有初始化系統游標位置；圖片載入前的移動又被忽略。

## 修正

1. 原生先保持視窗隱藏，保存凍結圖片與 session，等前端完成解碼。
2. 回傳實際游標相對圖片的像素座標；負桌面原點與 macOS 邏輯/Retina 座標分開投影。缺少系統游標時才回到圖片中心。
3. 前端先畫圖片、候選與放大鏡，呼叫 capture_prime。原生以 alpha 0 顯示且不啟用視窗，等待兩次 RAF 提交後再以 capture_present 顯示並取得焦點；Windows reveal 前等待 DwmFlush。
4. Windows 擷取覆蓋層統一使用原生 show/hide/focus，避免混用 Tao 快取的 VISIBLE 旗標而重設 Layered 透明度或取消無效；使用 SW_SHOWNOACTIVATE，暖機不啟用視窗。
5. 所有 prime/present 都驗證 session、busy 與待擷取圖片；取消、退出或逾時不能讓晚回來的畫面重新顯示。初始化錯誤回報準備失敗，不顯示黑底。
6. 保留使用者明確關閉放大鏡的偏好；每次新截圖重讀。載入期間的游標移動也保留。浮點縮放只對整數附近的 ULP 誤差修正，不改真實次像素座標。

## 驗證

- Headless：無 pointermove 就有正確放大像素、decode/prime gate 前不 present、重開游標更新、關閉偏好、初始化失敗。
- 純邏輯：CSS round-trip 不差一像素，負原點、Retina、螢幕邊界。
- 原生隔離 WebView：阻擋解碼時真實視窗仍隱藏；暖機時可見但 alpha 0、前景不變；放大鏡已畫好才 alpha 255。截取 prepared/visible PNG 親自查看，連續三輪並驗證載入期間取消。
- 全套 JS/元件/E2E/Rust、正式 build、跨平台 CI；資料與記憶體草稿保存後才替換執行版本。

證據保存在忽略的 artifacts/ 與 .tools/，真實桌面截圖不進版控。原生 IPC 測試不是實體按鍵或高速攝影測試，Mac 首幀仍需實機驗收。
