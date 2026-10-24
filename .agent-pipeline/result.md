# Night Shift Result（2026-10-25）

## 收尾
| 項目 | 狀態 | commit | 備註 |
|---|---|---|---|
| 對話合約獨立複核 | 進行中 | 待提交 | 無明確未完成承諾；存疑項目跳過 |

## 加分項（每行一個，可獨立 revert）
| # | 名稱 | Score | 參考來源（競品 / 專案 / 文章） | 做了什麼 | 驗證指令 | 測試狀態 | 否決的替代作法 |
|---|---|---|---|---|---|---|---|

## 判斷不值得做
- 尚待調研與獨立評分。

## 需要你決定的事
- 未追蹤設計草稿已完整 stash（docs/design/ 及兩張 hero 草圖），SHA 見 PRE_STASH；使用者決定何時還原。
- 真實 OS 跨程序貼上、Mac 實機及系統退出仍未驗證，本夜不操作正式環境。
- 初始化腳本自動審查回傳 blocked by policy，未執行；移除不必要的刪除步驟後，已以分開的非破壞指令完成分支與旗標。

## 統計
- 開始 START，截止 DEADLINE（預定 8 小時）。回合 1：建立分支、合約與資料圍欄。
- 結束原因：進行中。

- scope-reviewer 獨立複核：VERDICT: OK。無確定收尾工作；所有存疑項跳過。

| 01 | AI JSON 匯入型別與逐筆錯誤 | scores-01.md：10.7 | Raycast Snippets、MDN JSON.parse | 預計動 model.js 的import新區塊、i18n.js errorMessage小區塊、locales.js新增列、model.test.js新增區塊；測數字/null/欄位/四語/不變性 | npm test；npm run build:ui | 19/19 JS單元測試通過、前端build成功；4程式/測試檔，新增約70行 | 否決自動把物件轉字串（資料誤入）；否決引入schema套件（技能禁新增依賴） |

- 回合 2：加分01完成，嚴格JSON型別與四語欄位錯誤，npm test 19/19、build:ui成功；未執行外部或原生桌面測試。

| 02 | 四語 Unicode 多詞搜尋 | scores-02.md：10.5 | Raycast Snippets、MDN normalize | 計畫：新增snippet-search.js及純測試，main.js只改搜尋判斷與title，locales.js僅新增本項提示列；測全半形、日文、重音、跨欄多詞、原文不變 | npm test；npm run build:ui | 待實作 | 否決重排／改寫使用者資料（只做搜尋索引）；否決模糊搜尋套件（依賴與結果不可預期） |

- 回合3：加分02完成：多詞AND搜尋跨名稱/正文/有效情境，NFKC搜尋索引支援全半形與日文濁音，原文不變；npm test 22/22、build:ui成功。4個程式/測試檔。

| 03（候選04） | 管理畫面快捷操作指引 | scores-03.md：8.2 | Alfred browsing、Raycast quickstart | 計畫：新增usage-help.js純訊息、usage-help.test.js、main獨立usageBar區塊、locales新增列。主句先點輸入框；摺疊詳情列角色、取消與管理視窗收起。四語與自訂鍵同步 | npm test；npm run build:ui | 待實作 | 否決強制新手導覽（打斷）；否決修改快捷鍵核心（原行為使用者已確認） |

- 回合4：加分03（候選04）完成，四語提示與設定快捷鍵同步，原收起／取消邏輯未改；npm test 24/24、build:ui成功。未做視覺／系統按鍵測試。

| 04（候選03） | 複製目前角色純JSON | scores-04.md：5.8 | Raycast JSON import/export、Alfred sharing | 計畫：settings.js獨立匯出區/按鈕，model.js新序列化函式區，locales.js新列，model.test新測試區；測往返、順序、情境、空白、原物件不變 | npm test；npm run build:ui | 待實作 | 否決第三方備份服務（範圍）；否決複製草稿卻標已儲存（混淆來源），僅匯出native已存資料 |

- 回合5：加分04（候選03）完成；只複製native已儲存資料，情境/排序/原始空白不變，可再匯入。npm test 25/25與build:ui成功；未操作真實剪貼簿。
