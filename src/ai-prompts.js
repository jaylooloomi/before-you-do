import { getLanguage } from './i18n.js';
const format = {
 'zh-TW':'格式：JSON 陣列，每筆含必填 name、text 字串，可選填 scenario 情境字串（最多 1,000 字，保留既有情境，包含明確清空的空字串；情境不會貼入對話）。1～100 筆；名稱最多 100 字，內容最多 20,000 字，皆不可空白。陣列順序即 Alt+H 順序。換行請使用合法的 \\n 跳脫。',
 'zh-CN':'格式：JSON 数组，每项含必填 name、text 字符串，可选填 scenario 场景字符串（最多 1,000 字，保留现有场景，包括明确清空的空字符串；场景不会粘贴到对话）。1～100 项；名称最多 100 字，内容最多 20,000 字，均不能为空。数组顺序即 Alt+H 顺序。换行请使用合法的 \\n 转义。',
 en:'Format: a JSON array of 1–100 objects with required name and text strings and an optional scenario string (up to 1,000 characters). Preserve existing scenarios, including explicitly empty strings; scenarios are not pasted into conversations. Names: up to 100 characters; text: up to 20,000. Neither can be blank. Array order is the Alt+H order. Encode line breaks with valid \\n escapes.',
 ja:'形式：必須の name・text 文字列と任意の scenario 文字列（最大 1,000 文字）を持つ JSON 配列。空文字列を含め既存の使用場面を保持してください。使用場面は会話には貼り付けません。JSON 配列（1～100 件）。名前は最大 100 文字、内容は最大 20,000 文字。空欄不可。配列順が Alt+H の順番です。改行には正しい \\n エスケープを使用してください。',
};
export function filePrompt(path) {
 const lang=getLanguage();
 const instructions={
 'zh-TW':`請修改我的 before-you-do 短句檔。\n檔案路徑：${path}\n${format[lang]}\n先讀取原檔並另存備份，只修改我指定的項目，保留其他短句與排序，勿自動翻譯現有內容。保持 UTF-8 與合法 JSON，寫入後重讀驗證。無法讀寫此路徑時請明說，改為提供完整 JSON。完成後回報修改與備份位置，提醒我回 before-you-do 按「重新載入檔案」，避免舊內容覆蓋新檔。\n\n我的修改需求：〔在這裡補充〕`,
 'zh-CN':`请修改我的 before-you-do 短句文件。\n文件路径：${path}\n${format[lang]}\n先读取原文件并另存备份，仅修改指定项目，保留其他短句和排序，不要自动翻译现有内容。保持 UTF-8 及合法 JSON，写入后重新读取验证。无法读写此路径时请说明，并提供完整 JSON。完成后汇报修改及备份位置，提醒我回 before-you-do 点击“重新加载文件”，避免旧内容覆盖新文件。\n\n修改需求：[在这里补充]`,
 en:`Edit my before-you-do snippet file.\nFile path: ${path}\n${format[lang]}\nRead the current file and make a separate backup first. Change only the requested entries; preserve all other snippets and their order. Do not translate existing text automatically. Keep UTF-8 and valid JSON, then read the file back to verify. If you cannot access this path, say so and provide complete JSON instead. Report the edits and backup location. Remind me to click Reload file in before-you-do before saving stale editor contents.\n\nRequested changes: [add here]`,
 ja:`before-you-do の短文ファイルを編集してください。\nファイルのパス：${path}\n${format[lang]}\n元のファイルを読み、先に別のバックアップを作成してください。指定項目のみ変更し、他の短文と順番は保持してください。既存の内容を自動翻訳しないでください。UTF-8 と正しい JSON を維持し、書き込み後に再読込して検証してください。アクセスできない場合は明示し、代わりに JSON 全体を提示してください。変更点とバックアップ先を報告し、古い編集内容で上書きする前に before-you-do の「ファイルを再読み込み」を押すよう案内してください。\n\n変更依頼：[ここに追記]`,
 }; return instructions[lang];
}
export function chatPrompt(items) {
 const lang=getLanguage(), json=JSON.stringify(items,null,2);
 return {
 'zh-TW':`請依需求修改以下 before-you-do 短句。${format[lang]}\n只修改指定項目，保留其他名稱、內容與排序，不要自動翻譯。只回覆完整可匯入 JSON，不省略未修改項目，不加入說明。\n\n目前已儲存內容：\n${json}\n\n我的修改需求：〔在這裡補充〕`,
 'zh-CN':`请按需求修改以下 before-you-do 短句。${format[lang]}\n仅修改指定项目，保留其他名称、内容和排序，不要自动翻译。仅返回完整可导入 JSON，不省略未修改项目，不添加说明。\n\n已保存内容：\n${json}\n\n修改需求：[在这里补充]`,
 en:`Edit these before-you-do snippets as requested. ${format[lang]}\nChange only the requested entries. Preserve all other names, text and order; do not translate automatically. Return only the complete importable JSON, with no omitted entries or commentary.\n\nSaved snippets:\n${json}\n\nRequested changes: [add here]`,
 ja:`依頼に従って以下の before-you-do 短文を編集してください。${format[lang]}\n指定項目のみ変更し、他の名前・内容・順番は保持してください。自動翻訳はしないでください。未変更項目も省略せず、説明を付けずにインポート可能な JSON 全体のみを返してください。\n\n保存済みの短文：\n${json}\n\n変更依頼：[ここに追記]`,
 }[lang];
}
