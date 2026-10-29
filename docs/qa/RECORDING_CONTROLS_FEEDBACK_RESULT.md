# 錄影控制與音效驗證

2026-10-30；分支 codex/recording-controls-feedback；主要實作 d5d5ff5。

## 已完成

- 原生綠色虛線外框，暫停變黃；外框置頂、滑鼠穿透，不啟用底層程式。
- 選區附近的停止／暫停／繼續／取消與 HH:MM:SS 控制列，位置限制在螢幕工作區，負座標亦支援。
- 邊框與控制列均使用 WDA_EXCLUDEFROMCAPTURE；設定失敗拒絕開始，避免默默把控制列錄進素材。
- 暫停會結束擷取子程序並凍結計時，繼續錄下一個片段，最後串接成 WebM，或轉為 GIF。暫停時間不加入時鐘。取消刪除本次片段，不加入素材。
- 自製 0.36 秒 PCM WAV，素材保存成功才用 Windows PlaySound 非同步播放。取消、失敗不播放。沒有複製 ShareX 音效或 GPL 程式碼。

## 實際驗證

| 檢查 | 結果 |
|---|---|
| JavaScript | 53 通過 |
| Component | 15 通過；全 src 行覆蓋率 36.24%，不包含 node:test/E2E |
| Playwright 全套 | 59 通過，0 skipped、0 flaky；逐案 console.error/pageerror 攔截 |
| Windows Rust | 49 unit + 16 integration 通過；1 個既有 Alt+H 註冊測試仍為 opt-in ignored |
| 正式 build | npm run build -- --no-bundle 成功 |
| 原生錄影 | node scripts/test-native-recording.mjs 與 --ui 模式通過 |
| 原生舊流程 | node scripts/test-native-capture-ipc.mjs 通過；0 可見測試視窗、0 Runtime Error |

--ui 模式確實顯示隔離 Tauri 的原生錄影外框與 WebView 控制列，無桌面鍵鼠注入。外框矩形 (-1742,138,364,244)，工具列 (-1750,384,380,42)。兩視窗 affinity 均為 17，外框滑鼠穿透、可見。從實際視窗 DC 讀到 180 個綠色邊緣像素；暫停後亦斷言黃色像素大於零，並核對兩種狀態的控制列截圖。

實測 WebM/GIF 都錄到 360×240，分別 37829／701820 bytes；經暫停、繼續、合併後 ffprobe 識別 vp8／gif，FFmpeg 全片解碼成功、無音軌、素材保存與匯出成功。取消測試確認素材數不變，completion_sound_played=false。完成時兩次 PlaySound API 均回傳成功；WAV 單元測試確認真實非靜音 PCM 波形。這不代表已用人耳判定使用者喇叭音量或聽感。

本機忽略的證據：artifacts/native-recording-1793300372694/result.json、video-controls.png、video-paused-controls.png、gif-controls.png、gif-paused-controls.png。已透過圖片檢視器查看真實 WebView 的停止／暫停／繼續／取消及計時，另有 Headless fixture 截圖；兩者沒有混稱。

## 升級與範圍

正式根目錄 App 已替換並重新開啟至素材頁，PID 90820；執行檔 SHA-256 與正式 build 一致。私人備份在忽略的 .tools/upgrades/recording-feedback-20261030/。所有原有磁碟檔案 hash、六組記憶體角色狀態、草稿旗標、版本基線、localStorage 與素材均核對保留；沒有強制儲存短句草稿。

ShareX 保持執行。原本 Ctrl+Shift+F6～F10 配置仍在，五鍵註冊成功；Alt+H 未改。全程未用 Computer Use、桌面鍵鼠注入或系統剪貼簿。實體按鍵／滑鼠、混合 DPI 及人耳音效驗收仍未執行。Windows 無聲錄影是本次範圍，不宣稱加入 ShareX 的攝影機、收音或全部編輯器；Mac 錄影仍不支援。沒有合併 main 或發布 Release。
