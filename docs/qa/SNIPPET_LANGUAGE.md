# 內建短句隨語系切換

## 行為

- 12個角色的未修改內建範本會隨繁中、簡中、英文、日文切換名稱、正文與原始情境；Rust快捷選取也使用同一語言的正文。
- 只做顯示/提交投影，不因語系切換呼叫save_snippets或改寫角色JSON，外部改檔保護baseline維持原始資料。
- 新增、範本庫加入、匯入、編輯的項目使用選填 `custom: true` 保護；model、JSON匯出/匯入、Rust serde均保留此標記。舊檔沒有標記仍可讀，false不輸出。
- 舊資料只在名稱、正文以及存在的情境都符合某語言的內建版本時才視為原始範本；自訂名稱或內容不靠文字局部比對、位置或陣列長度猜測。完全相同但沒有任何來源標記的歷史副本無法區分，仍保留原始檔案，只影響顯示與選取投影；新增副本已有明確標記，不再有這個歧義。
- 自訂情境（含明確空字串）、使用者文字與跨角色未儲存草稿保留；語系切換本身不標示成未儲存編輯。

## 位置與回歸

- `src/localized-snippet.js`、`src/roles.js`：前端精確匹配與翻譯投影。
- `scripts/generate-role-defaults.mjs`：生成 `src/role-localization.json`，供Rust使用相同的四語翻譯與情境。
- `src-tauri/src/roles.rs`、Picker::finish_in_language：原生提交使用對應語言，但保留原角色/快照。
- `tests/localized-snippet.test.js`：所有角色/四語、舊版完整情境、自訂欄位、自訂標記儲存往返。
- `tests/e2e/snippet-language.spec.js`：實際DOM四語切換、名稱/正文、使用者新增副本、草稿、重整及picker。
- Rust `localized_commit_pastes_translated_builtin_without_changing_snapshot`：英文提交、原始帶情境範本、自訂副本、取消、原始快照不變。

使用 `npm run test:qa` 執行兩輪；原生OS快捷鍵註冊仍略過，沒有操作正在使用的App、原始資料、剪貼簿或Computer Use。真正的跨程序貼上與Mac硬體仍是驗證邊界。
