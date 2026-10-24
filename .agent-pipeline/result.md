# Night Shift Result（2026-10-25）

開始 2026-10-25 01:48｜結束 2026-10-25 02:15｜實際執行 0h27m／預定 8h00m｜提早 7h33m 收工

## 收尾
| 項目 | 狀態 | commit | 備註 |
|---|---|---|---|
| 無明確未完成承諾 | 0項收尾、0項失敗 | 1f174c5 | scope-reviewer獨立複核 VERDICT: OK；存疑的OS貼上/Mac實機不做 |

## 加分項（八項，分別審閱與回退）
| # | 名稱 | Score | 參考來源 | 做了什麼／commit | 驗證指令 | 測試狀態 | 否決的替代作法 |
|---|---|---|---|---|---|---|---|
| 01 | AI JSON型別與逐筆錯誤 | [10.7](scores-01.md) | [Raycast Snippets](https://manual.raycast.com/snippets)、MDN JSON.parse | 不再將數字/物件誤存成短句；四語指出列與欄位；b490a6f | npm test、npm run build:ui | ✅ | 自動轉字串；新增schema套件 |
| 02 | 四語Unicode多詞搜尋 | [10.5](scores-02.md) | Raycast Snippets、[MDN normalize](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) | 名稱/正文/有效情境跨欄AND搜尋，全半形/日文/重音統一查找但不改原文；751ef9f | npm test、build:ui | ✅ | 修改使用者資料；引入模糊搜尋套件 |
| 03 | 快捷操作說明 | [8.2](scores-03.md) | Alfred Snippets、Raycast quickstart | 先點輸入框、自訂快捷鍵、取消與管理視窗只收起的四語提示；21702f7 | npm test、build:ui | ✅純訊息測試；未視覺驗證 | 強制導覽；改快捷鍵核心 |
| 04 | 目前角色JSON匯出 | [5.8](scores-04.md) | Raycast JSON import/export、Alfred sharing | 明示只複製已存內容，包含情境/排序，無草稿；20dd3aa | npm test、build:ui | ✅序列化往返；未碰剪貼簿 | 第三方備份服務；把草稿混稱已存 |
| 05 | 外部AI改檔衝突保護 | [2.9](scores-05.md) | [VSCode Preventing dirty writes](https://code.visualstudio.com/docs/editing/getting-started/tips-and-tricks#_preventing-dirty-writes) | 各角色深複製baseline，儲存/匯入前偵測外部內容變更或刪除，不自動重建已知被刪角色；8e61708、a80c1f0、e405297（同項續片，回退需逆序三筆） | cargo test --offline、npm test、build | ✅tempfile與快照單元；未App整合 | 直接覆寫；自動merge/新增鎖套件 |
| 06 | Windows UTF8 BOM相容 | [12.3](scores-07.md) | [Unicode BOM](https://unicode.org/faq/utf_bom.html)、Microsoft UTF8Encoding、RFC8259 8.1 | 先重現載入失敗，再僅忽略一個檔頭BOM，正文/原檔不變；29358e4 | cargo test --offline、build | ✅ | 猜測UTF16；自動重寫原檔 |
| 07 | 情境固定註明不貼入 | [7.5](scores-08.md) | [Textfold](https://textfold.app/)、Alfred（設計推論） | 內建/自訂情境始終顯示不貼入正文，仍保留來源；31d9f8b | npm test、build:ui | ✅ | 把情境一起貼入；移除出處 |
| 08 | AI匯入前名稱預覽 | [4.7](scores-09.md) | [Textfold importing](https://textfold.app/docs) | 確認前顯示已存數、取代數、前5個名稱與未列出數，長名不拆emoji，保留草稿/備份提醒；75b850e | npm test、build:ui | ✅純預覽測試；未原生視覺驗證 | 自動合併；在確認窗塞100筆正文 |

## 判斷不值得做
6項新候選未達門檻：草稿自動復原0.6、自訂角色0.3、動態模板0.3、歷史版本回復0.3、picker打字搜尋0.3、跨格式YAML匯入0（需新依賴）。已完成候選標DUPLICATE，不重做。最後兩輪 [scores-10](scores-10.md) 與 [scores-11](scores-11.md) 連續 TOP:none；依技能提前收工，並非已跑足8小時。

## 需要你決定的事
1. 既有未追蹤設計稿已完整保存在 stash `e46764077fc9ef0ed02ace7b2aa69d4f0c51d0f5`（night-shift pre-stash 2026-10-25；docs/design/ 與兩張hero草圖）。未刪除、未套用；由你決定何時還原。
2. 如要跨格式YAML/Alfred封裝匯入，需另行決定是否允許新依賴與資料轉換範圍，本夜未加套件。

## 驗證限制與資料保護
- 本夜只跑離線單元測試。正式App未操作、未重啟、未替換；未讀寫你的短句、設定或未儲存草稿；沒有Computer Use、系統輸入、外部對話框或剪貼簿測試。
- 最終31項JS通過；20項Rust通過、1項會註冊原生快捷鍵的測試略過。前端Vite建置與 CARGO_NET_OFFLINE=true 的 npm run build -- --no-bundle 成功（Windows）。
- Native artifact在 src-tauri/target/release/before-you-do.exe，沒有複製到正在使用的根目錄正式版，也沒有上Release。未修改CI、package/lock、環境或設定檔。
- 新增UI僅經單元與建置驗證，未宣稱視覺/跨程序貼上/Mac實機/系統退出通過。外部改檔比較不是跨程序交易鎖，仍有比較與rename間的短暫競爭窗口；已知刪除會阻止重建，需人工還原檔案再繼續。
- 自動審查曾拒絕含不必要清除步驟的初始化腳本，原因僅 blocked by policy。該腳本未執行；省略刪除後以非破壞指令完成初始化。

## 統計
- 收尾0完成／0失敗；加分8完成／0失敗（05分三片，其他各一筆）。獨立scope/scorer審查已執行。
- 工作/調研回合12；20個commit、41個修改檔（含夜班證據；產品/測試19檔），淨增803行。
- 最後建置：Windows Tauri --no-bundle成功；最後測試：JS31/31、Rust20通過1略過；fmt與diff檢查通過。
- 結束原因：無候選（連續兩輪TOP:none），時間紀錄見上方與TIMING。
- 分支 night-shift/2026-10-25，基於BASE中的main；僅收工推送此分支，不合併、不推main、不發布Release。

<details>
<summary>TOP:none 的獨立評分原表（完整保留）</summary>

### scores-06.md

| # | Candidate | Impact | Urgency | Effort | Blast | Score | Reason |
|---|---|---|---|---|---|---|---|
| 05 | 草稿自動持久化／復原 | 8 | 5 | 9 | 8 | 0.6 | 僅評意外中斷復原，排除 457bf48 已完成退出確認；超過規模門檻且可能觸設定圍欄，本輪不可直接實作。 |
| 07 | 角色自訂建立／刪除 | 7 | 4 | 9 | 9 | 0.3 | 有分類參考但固定角色已能完成核心流程；跨原生白名單、持久化及 picker 超過規模，不能直接實作完整候選。 |
| 08 | 動態模板參數 | 6 | 3 | 8 | 8 | 0.3 | 有官方參考但填值流程牽動核心放開即貼行為，相容風險高；不得自動解讀既有大括號，需先切片。 |
| 01 | AI JSON 匯入嚴格型別與逐筆錯誤 | 8 | 8 | 3 | 2 | 0.0 | DUPLICATE：b490a6f 已完成；去重覆寫公式得分。 |
| 02 | 四語管理搜尋的 Unicode 與多詞匹配 | 7 | 6 | 2 | 2 | 0.0 | DUPLICATE：751ef9f 已完成；去重覆寫公式得分。 |
| 03 | 純 JSON 複製匯出目前角色 | 7 | 5 | 3 | 2 | 0.0 | DUPLICATE：20dd3aa 已完成；去重覆寫公式得分。 |
| 04 | 管理畫面首次操作提示補齊 | 7 | 7 | 2 | 3 | 0.0 | DUPLICATE：21702f7 已完成；去重覆寫公式得分。 |
| 06 | 外部 AI 改檔後阻止舊內容覆蓋 | 9 | 8 | 5 | 5 | 0.0 | DUPLICATE：8e61708、a80c1f0 已完成原生比較與跨角色快照隔離；去重覆寫公式得分。 |

TOP: none (all below 2)

### scores-10.md

| # | Candidate | Impact | Urgency | Effort | Blast | Score | Reason |
|---|---|---|---|---|---|---|---|
| 05 | 草稿自動持久化／復原 | 8 | 5 | 9 | 8 | 0.6 | 僅評意外中斷復原，排除 457bf48 已完成退出確認；超過規模門檻且可能觸設定圍欄，未切片前不可直接實作。 |
| 07 | 角色自訂建立／刪除 | 7 | 4 | 9 | 9 | 0.3 | 固定角色已滿足核心流程；完整候選跨原生白名單、持久化及 picker 超規模，不能直接實作。 |
| 08 | 動態模板參數 | 6 | 3 | 8 | 8 | 0.3 | 有官方來源但填值牽動放開即貼流程，相容風險高；不得自行解讀既有大括號，需先切片。 |
| 01 | AI JSON 匯入嚴格型別與逐筆錯誤 | 8 | 8 | 3 | 2 | 0.0 | DUPLICATE：b490a6f 已完成；去重覆寫公式得分。 |
| 02 | 四語管理搜尋的 Unicode 與多詞匹配 | 7 | 6 | 2 | 2 | 0.0 | DUPLICATE：751ef9f 已完成；去重覆寫公式得分。 |
| 03 | 純 JSON 複製匯出目前角色 | 7 | 5 | 3 | 2 | 0.0 | DUPLICATE：20dd3aa 已完成；去重覆寫公式得分。 |
| 04 | 管理畫面首次操作提示補齊 | 7 | 7 | 2 | 3 | 0.0 | DUPLICATE：21702f7 已完成；去重覆寫公式得分。 |
| 06 | 外部 AI 改檔後阻止舊內容覆蓋 | 9 | 8 | 5 | 5 | 0.0 | DUPLICATE：8e61708、a80c1f0、e405297 已完成；去重覆寫公式得分。 |
| 09 | Windows UTF-8 BOM 短句檔相容讀取 | 7 | 7 | 2 | 2 | 0.0 | DUPLICATE：29358e4 已完成；去重覆寫公式得分。 |
| 10 | AI JSON 套用前預覽將取代的短句 | 7 | 6 | 3 | 3 | 0.0 | DUPLICATE：75b850e 已完成；去重覆寫公式得分。 |
| 11 | 情境欄固定標示不會貼入 | 6 | 5 | 2 | 2 | 0.0 | DUPLICATE：31d9f8b 已完成；去重覆寫公式得分。 |

TOP: none (all below 2)

### scores-11.md

| # | Candidate | Impact | Urgency | Effort | Blast | Score | Reason |
|---|---|---|---|---|---|---|---|
| 05 | 草稿自動持久化／復原 | 8 | 5 | 9 | 8 | 0.6 | 僅評意外中斷復原，排除 457bf48 已完成退出確認；超過規模門檻且可能觸設定圍欄，未切片前不可直接實作。 |
| 14 | App 內一鍵回復歷史備份 | 7 | 4 | 9 | 9 | 0.3 | 有官方歷史版本參考，但已有上一版備份與 JSON 匯出；涉及資料復原契約、草稿及至少七檔，成本與影響過大。 |
| 07 | 角色自訂建立／刪除 | 7 | 4 | 9 | 9 | 0.3 | 固定角色已滿足核心流程；完整候選跨原生白名單、持久化及 picker 超規模，不能直接實作。 |
| 08 | 動態模板參數 | 6 | 3 | 8 | 8 | 0.3 | 有官方來源但填值牽動放開即貼流程，相容風險高；不得自行解讀既有大括號，需先切片。 |
| 13 | 在快捷選單直接打字搜尋 | 7 | 4 | 9 | 10 | 0.3 | 有官方搜尋參考，但與不搶焦點及 Alt 放開流程衝突；至少六檔且無可獨立驗證的安全小片，不能直接採用。 |
| 12 | 跨格式匯入 Espanso YAML／Alfred 封裝 | 5 | 2 | 8 | 6 | 0.0 | NEEDS-DEP：可靠 YAML／封裝解析需新增第三方套件，技能禁止；不得用 regex 規避。 |
| 01／02／03／04／06／09／10／11 | 已完成候選 | — | — | — | — | 0.0 | DUPLICATE：分別見 b490a6f、751ef9f、20dd3aa、21702f7、8e61708／a80c1f0／e405297、29358e4、75b850e、31d9f8b；去重覆寫公式得分。 |

TOP: none (all below 2)

</details>
