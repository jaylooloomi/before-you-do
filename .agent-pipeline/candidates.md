# Candidates — 第一輪

所有候選只改既有 App/文件與單元測試，不碰正式資料、套件／CI／設定檔，不使用系統輸入。引用僅學習行為，不搬程式碼／素材。最新 commit 已排除角色切換、儲存與退出等已完成項目。

## 01 — AI JSON 匯入嚴格型別與逐筆錯誤
因為原始需求是 **讓使用者用自己的 AI 修改常用補充指令並安全放回工具**，所以頂尖做法會順便做 **對匯入格式明確驗證、指出哪一筆哪個欄位有誤**；目前的成果 **只有部分**，可把 name/text 的數字、物件轉成文字，null 會出現 TypeError，整批錯誤也未定位。
- 參考：Raycast 官方 Snippets Import（JSON array/object schema）：https://manual.raycast.com/snippets#exporting-and-importing-snippets；MDN JSON.parse 說明型別可能包含 null、number、object：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse。
- 範圍：src/model.js 的 import 專屬新驗證函式、src/i18n.js 的結構化錯誤呈現、src/locales.js 翻譯及 tests/model.test.js（≤4 檔，≤180 行）。保留 editor 的既有儲存語意。
- 驗證：純 Node JSON 例子、惡意型別／null／array、錯誤索引與欄位、四語訊息、正確多行與情境、輸入不變。npm test +本機建置。

## 02 — 四語管理搜尋的 Unicode 與多詞匹配
因為原始需求是 **從自己的四語短句快速找到適合的補充指令**，所以頂尖做法會順便做 **跨名稱、正文與情境搜尋且容忍全形／半形與多詞順序**；目前的成果 **只有部分**，管理搜尋直接比對小寫連續字串，AI/ＡＩ、兩個不相鄰詞無法互找。
- 參考：Raycast 官方用 Name／Keyword／Content 搜尋：https://manual.raycast.com/snippets；MDN Unicode normalize：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize。
- 範圍：新增 src/snippet-search.js、tests/snippet-search.test.js，src/main.js 只替換搜尋判斷（3檔，≤130行）。不變更資料，只正規化搜尋索引。
- 驗證：四語、全形ASCII、組合重音、跨欄多詞、空白、標點、輸入不變。

## 03 — 純 JSON 複製匯出目前角色
因為原始需求是 **能用自己的 AI 管理短句並保留編輯控制權**，所以頂尖做法會順便做 **直接取得可還原的純 JSON 匯出，而不必先剪掉 AI 指令**；目前的成果 **沒有**專用匯出，只有複製含 JSON 的聊天指令與手動找檔。
- 參考：Raycast 官方 JSON import/export：https://manual.raycast.com/snippets；Alfred 官方 sharing collections：https://www.alfredapp.com/help/features/snippets/sharing/。
- 範圍：src/settings.js 匯出按鈕、src/model.js 新序列化 helper（自己新區塊、不改候選01）、src/locales.js 新翻譯、tests/model.test.js 新測試（4檔≤100行）。呼叫現有 copy_text，不引入系統檔案對話框或新套件。
- 驗證：純單元測試可匯回、情境與順序、原始物件不變。未執行真實剪貼簿測試。

## 04 — 管理畫面首次操作提示補齊
因為原始需求是 **在對話框中一鍵補上指令**，所以頂尖做法會順便做 **在快捷操作旁說清楚先回到目標輸入框，避免首次在管理畫面按快捷鍵只消失**；目前的成果 **只有部分**，README有步驟但 App 顯示「按住喚出」未提管理視窗先收起。
- 參考：Alfred browsing snippets 官方解釋目標 app 插入：https://www.alfredapp.com/help/features/snippets/browsing/；Raycast Quickstart：https://manual.raycast.com/quickstart。
- 範圍：src/main.js 使用說明區自有小區塊、src/locales.js、必要純訊息 helper 與測試（≤4檔≤100行）。保留 manager 快捷鍵只收起、設定列目的地與所有原有文案定位。不做新導覽頁。
- 驗證：純訊息輸出含自訂快捷鍵／修飾鍵，不需OS測試。

## 05 — 草稿自動持久化／復原（需大幅切片，建議不採）
因為原始需求是 **保留所有未儲存短句與草稿**，所以頂尖做法會順便做 **程式中斷後恢復草稿**；目前的成果 **沒有**持久化草稿，正常退出確認已有，故不能重作457bf48。
- 參考：VS Code 官方 Hot Exit：https://code.visualstudio.com/docs/editor/codebasics#_hot-exit。
- 規模風險：要新增原生路徑／schema、跨角色同步及恢復 UI，很可能>5檔／300行；可能觸及設定圍欄。若評分仍高，須先切為純規劃或明確獨立第一片，否則往下。
- 本輪不新增依賴，真實用戶資料不得讀寫。

# Candidates — 第二輪（第一輪已完成01/02/03/04）

## 06 — 外部 AI 改檔後阻止舊內容覆蓋
因為原始需求是 **讓使用者用自己的 AI 直接修改本機短句且保留既有資料**，所以頂尖做法會順便做 **儲存前偵測磁碟已被外部改動，讓使用者先保留草稿再重載**；目前的成果 **沒有**，只在教學文字提醒。save_snippets 直接寫檔；在另一角色停留時，前角色快取也可能過期。
- 參考：VS Code 官方 basic editing 的 Preventing dirty writes/save conflicts（以官方文件目前網址為準）：https://code.visualstudio.com/docs/editor/codebasics；Rust fs rename語意：https://doc.rust-lang.org/std/fs/fn.rename.html。
- 方案：前端為各角色保存獨立的已讀資料snapshot（複製，不能與editor物件共用），儲存傳入；Rust儲存前比對目前檔案存在性及解析內容，改動則拒寫、保留草稿/備份，提示先備份再reload。JSON空白格式差異不視為改動。匯入也帶snapshot。Native呼叫未傳snapshot保留相容性。
- 規模：src/main.js、src-tauri/src/main.rs、src-tauri/src/storage.rs（含純tempfile單元測試）、src/locales.js，預估4檔≤220行；不改前幾項自己新增區塊。若超規模僅做native helper與測試第一片，後續沿同編號續做。
- 驗證：只用自身暫存檔的Rust unit tests，測外部內容修改、刪除／建立、格式相同、備份未被破壞；純JS檢查snapshot複製。依技能不跑原生App整合或系統輸入。
- 限制：不是跨程序交易鎖，不保證比較後瞬間同時寫入；若需鎖及多版本合併則另議。

## 07 — 角色自訂建立／刪除（規模風險）
因為原始需求是 **不同角色有自己的常用短句**，所以頂尖做法會順便做 **使用者自建分類**；目前的成果 **只有固定12角色**。
- 參考：Alfred collections：https://www.alfredapp.com/help/features/snippets/。
- 須變動native roles白名單、角色持久化、UI管理與picker，至少6檔，可能觸設定圍欄；本輪只可規劃，不能直接上完整功能。

## 08 — 動態模板參數（規模與相容風險）
因為原始需求是 **快速補充每次不同的文字要求**，所以頂尖做法會順便做 **明確選擇的模板填值**；目前的成果 **沒有**。
- 參考：Espanso forms：https://espanso.org/docs/matches/forms/；Raycast dynamic placeholders：https://manual.raycast.com/dynamic-placeholders。
- 需要新的原生選取與放開行為、schema和預覽；不能把既有大括號當模板自行替換。很可能超過5檔及300行，不能直接實作整體；若評分高須再切片。
