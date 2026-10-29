# 跨平台截圖實作與測試結果

日期：2026-10-29（Asia/Taipei）
分支：codex/capture-platform-plan；實作基底：35b01e1。
完整待辦與驗收矩陣：../plans/CAPTURE_PLATFORM_TODO.md。

## 已完成實作

- 抽出 capture/mod.rs、windows.rs、macos.rs，分開素材保存、影像格式、平台擷取與 UI 協調。IPC 的三種模式名稱及素材資料格式維持相容。
- 共用型別：CaptureMode / CaptureRequest / CaptureError / Capabilities / Permission / Frame / LogicalBounds。檢查空影像、RGBA 長度、64M 像素、座標整數溢位、PNG 與裁切邊界。
- Windows 沿用桌面 GDI 擷取與前景事件追蹤；改用 DwmFlush 等待合成，移除猜測式延遲；使用安全的桌面矩形交集並拒絕已失效/最小化目標。
- macOS 使用編譯進 App 的 Objective-C 橋接，透過 ScreenCaptureKit 取得顯示器及獨立視窗圖片。沒有新增 .NET、ShareX 或 Swift 執行環境。
- 新截圖最低 macOS 14，App 最低仍為 11。ScreenCaptureKit 弱連結，舊系統回傳不支援而不呼叫新 API；不把弱連結檢查當成舊機開機實測。
- macOS 顯示器以邏輯桌面範圍、最高像素比例合成；Frame 分開保留邏輯覆蓋層範圍與圖片實體像素。NSWorkspace 啟用事件記住其他 App，擷取時由該 App 的前景一般視窗識別目標，排除自己的視窗。
- 能力查詢不請求授權。使用者明確按授權按鈕才呼叫系統權限請求；拒絕/撤銷、舊系統、設定開啟失敗與重新檢查均有四語提示。文字/附件不因截圖不可用而停用。
- 截圖加入 generation/session 驗證。取消/退出會使未完成工作失效；較晚回來的工作不能寫入素材或重新顯示覆蓋層。資料交付與取消由 operation mutex 協調，區域視窗在 UI thread 建立/顯示。
- 過期框選會讀取目前 frame，使用者可以重選或取消。退出時先關閉擷取狀態，再回到既有草稿保存/放棄確認流程。

## 已執行的本機測試

| 層級 | 指令/方式 | 結果 |
|---|---|---|
| JavaScript 邏輯 | npm test | 46 通過 |
| 元件 | npm run test:components | 15 通過；capture-access.js 行覆蓋率 95.65%，分支 86.95% |
| Headless E2E | npm run test:e2e | 45 通過，0 skipped / flaky；監聽 console.error 與 pageerror |
| Windows Rust | cargo test --manifest-path src-tauri/Cargo.toml | 42 unit + 16 integration 執行通過；1 個既有全域熱鍵註冊測試仍為 opt-in/ignored，避免干擾執行中的舊版 |
| 正式建置 | npm run build -- --no-bundle | 成功，v0.5.0 開發版 |
| 原生擷取 | before-you-do.exe --material-capture-audit <全新輸出目錄> | 雙螢幕原點 (-1920,0)、3840x1080 PNG；視窗 506x470；裁切 160x120 |
| 影像獨立驗證 | Pillow 解碼上述 PNG | RGBA/alpha 正確；裁切所有像素與原圖子區域完全一致 |
| 真實 Tauri IPC | node scripts/test-native-capture-ipc.mjs | 能力查詢、無效模式/過期 session 拒絕、隔離保存/排序/移除/匯出通過；無 App 視窗顯示，0 console/page errors |

原生 IPC 檢查啟動獨立 --design-preview --autostart 程序與獨立 WebView profile，只以 JS 呼叫本程式 IPC。可見性以 Win32 API 唯讀確認，排除 Tao 的內部事件迴圈 target HWND。測試不產生桌面鍵盤/滑鼠事件，不讀寫系統剪貼簿；結束只終止自己建立的子程序。

E2E 另覆蓋權限拒絕/授權/撤銷、明確開啟設定、權限查詢失敗、四語提示、素材文字保留、舊系統可用文字/檔案，以及原本 Alt+H、角色、匯入、短句保存和退出保護。100%/150%/200% 為座標幾何測試，非混合 DPI 實機框選。

## Mac 與跨平台 CI 證據

實作提交 35b01e1 的完整工作流程：
https://github.com/jaylooloomi/before-you-do/actions/runs/40833189328

- Windows、macos-latest（Apple Silicon）、macos-15-intel 三個 job 均成功；Release job 依分支規則略過，沒有公開發行。
- 兩種 Mac 架構各 40 unit + 16 integration 執行通過。
- 兩種架構的 bridge_raster_conversion_and_scaling_do_not_require_capture_permission 原生測試通過；它實際呼叫 Apple CoreGraphics 轉換/縮放 fixture，但不讀取螢幕或請求 TCC。
- macOS App 打包成功；verify-macos-capture.mjs 以 otool 確認 ScreenCaptureKit 為 LC_LOAD_WEAK_DYLIB。
- CI 的可編譯、原生 fixture 與 weak-link 結果，不等同於 TCC、真實 Retina 截圖或舊版 macOS 啟動已驗證。

## 資料保留與範圍

20 份既有 JSON/設定/備份的 SHA-256 與測試前相同；原本程序 PID 59516 保持執行。沒有替換根目錄的 before-you-do.exe，也沒有操作其短句或記憶體草稿。截圖證據與隔離資料都在忽略的 artifacts/ 或 preview 暫存目錄，不進 Git。

仍待實機：Mac 首次允許/拒絕/撤銷 TCC 與三種擷取、Retina/不同螢幕配置、macOS 11–13 實際啟動，以及 Windows 混合 DPI 的實際框選。外部視窗的人工關閉/最小化及 HDR 色彩亦未操作驗收。受保護內容可被 OS 阻擋；Windows 擷取的是可見桌面像素，Mac 採獨立視窗，兩者語義不同且已於介面說明。

本輪沒有使用 Computer Use，也沒有合併 main、發布 Release、替換使用者目前執行中的版本，或新增全域快捷鍵/自動上傳/自動送出。
