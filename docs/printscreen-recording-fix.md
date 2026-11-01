# PrintScreen 快捷鍵錄製修正

## 問題

錄製器只處理 keydown；Windows／WebView 的 PrintScreen 可能只有 keyup，或只有 code=PrintScreen 而 key=Unidentified。系統／已註冊快捷鍵也可能先攔截事件，導致欄位維持舊值。

## 修正

- keyup 也能錄製 PrintScreen，優先識別實體 code，保留 Ctrl／Alt／Shift。
- Windows 原生低階鍵盤 hook 僅在管理視窗的快捷鍵欄位錄製中、且該 HWND 為前景時攔截 VK_SNAPSHOT；放開時轉送標準綁定，不啟動截圖。
- 焦點離開或結束錄製後，仍保留原有快捷鍵操作。儲存時沿用重複／系統占用檢查。

## 驗證

- Node：59 項通過。
- Vitest：15 項通過。
- Rust：65 unit + 17 integration 通過；既有 1 項系統熱鍵修改測試維持 ignored。
- Playwright：8 項快捷鍵相關案例通過，含 keyup-only Alt+PrintScreen、Unidentified 實體鍵、保存與重載、原生事件轉送焦點限制、草稿保存與衝突防呆。全域 console/page error 檢查通過。
- 未用 Computer Use 或向使用者桌面注入硬體按鍵。實體鍵盤／其他截圖工具的攔截順序仍需以使用者環境確認。

- 正式 build 已切換並開啟快捷鍵頁；實際 WebView 確認 keydown／keyup 監聽器、原生快捷鍵註冊正常。已核對安裝檔 SHA256 一致，還原角色及欄位草稿，67 個資料檔逐位元比對保留。
