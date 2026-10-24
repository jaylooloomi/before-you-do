import { t, getLanguage, getPreference, setLanguage, onLanguageChange, errorMessage } from './i18n.js';
import { filePrompt, chatPrompt } from './ai-prompts.js';
import { getTemplates } from './template-locales.js';
import { parseSnippetImport } from './model.js';

export function createSettingsPage({ invoke, askConfirmation, onBack, onReload, onImport, onAddTemplate }) {
  const panel = document.createElement('section');
  panel.className = 'settings-panel'; panel.hidden = true;
  panel.innerHTML = `<header class="settings-heading"><div><h2>設定與 AI 教學</h2><p>用你習慣的 AI 管理短句，不需要串接 API。</p></div><button type="button" data-settings="back">返回短句</button></header>
    <section class="settings-card"><h3>介面語言</h3><select id="language" aria-label="介面語言"><option value="system">跟隨系統</option><option value="zh-TW">繁體中文</option><option value="zh-CN">简体中文</option><option value="en">English</option><option value="ja">日本語</option></select><p>切換語言不會翻譯或修改你的短句。</p></section>
    <section class="settings-card"><h3>範本庫</h3><p>預覽並新增範本；不會取代現有短句。</p><select id="template-language" aria-label="範本語言"><option value="zh-TW">繁體中文</option><option value="zh-CN">简体中文</option><option value="en">English</option><option value="ja">日本語</option></select><select id="template-choice" aria-label="範本庫"></select><div id="template-preview"><h4></h4><p></p><pre></pre></div><button type="button" data-settings="template">新增此範本</button></section>
    <section class="settings-card"><h3>短句存在哪裡？</h3><p>以下是這台電腦的實際位置。名稱、內容與排序都存在同一份 JSON。</p><code id="data-path"></code><div class="settings-buttons"><button data-settings="folder">開啟資料夾</button><button data-settings="path">複製檔案路徑</button></div><p class="settings-backup">上一版備份：<code id="backup-path"></code></p><p id="file-exists"></p></section>
    <section class="settings-card"><h3>讓能操作本機檔案的 AI 直接修改</h3><p>適用於已取得此檔案存取權限的桌面／程式開發 AI 工具。一般網頁聊天不能僅憑路徑讀寫你的電腦。</p><ol><li>先在 Before You Do 儲存要保留的編輯。</li><li>複製下方指令，貼給你的 AI，再補上想修改的需求。</li><li>AI 修改檔案後，回到這裡按「重新載入檔案」。不要先按舊編輯畫面的儲存，以免蓋回舊內容。</li></ol><textarea id="file-ai-prompt" readonly aria-label="直接修改檔案的 AI 指令"></textarea><div class="settings-buttons"><button data-settings="file-prompt">複製修改指令</button><button data-settings="reload">重新載入檔案</button></div></section>
    <section class="settings-card"><h3>使用一般聊天 AI：複製 → 修改 → 套用</h3><p>複製的指令會包含目前已儲存的短句。貼給 AI 修改後，把完整 JSON 貼回下方；也接受 JSON 程式碼區塊。</p><div class="settings-buttons"><button data-settings="chat-prompt">複製聊天 AI 指令與短句</button></div><textarea id="import-json" spellcheck="false" placeholder='貼上 AI 回傳的完整 JSON，例如 [{"name":"短句名稱","text":"短句內容"}]' aria-label="AI 回傳的短句 JSON"></textarea><p>套用會取代整份清單與排序，並先備份原檔；確認前會檢查格式。未完成草稿也會被取代。</p><div class="settings-buttons"><button data-settings="import">檢查並套用 JSON</button></div></section>
    <section class="settings-card"><h3>怎麼請 AI 修改比較有效？</h3><ul><li><b>交代用途：</b>例如「補在開發需求後，請 AI 自主完成並回報」。</li><li><b>交代修改範圍：</b>例如「只改第三句，其他名稱、內容和順序不變」。</li><li><b>描述期待行為：</b>例如「先整理理解再做，不用逐步確認；遇到缺少權限時再問我」。</li><li><b>用實際任務試用：</b>觀察回覆與操作結果，再調整短句；提示詞無法保證 AI 一定完成或沒有錯誤。</li></ul><p>只改名稱不會影響原範本的情境提示；改寫正文後，原情境提示會隱藏。資料檔請保留 name、text 兩個文字欄位，不要放入其他設定。</p></section>
    <section class="settings-card"><h3>備份與還原</h3><p>每次由 Before You Do 儲存時，snippets.json.bak 保留上一版，不是完整歷史紀錄。需要還原時，先從系統匣完整結束 Before You Do，另外保留目前檔案，再將備份複製成 snippets.json，最後重新啟動。外部 AI 修改前也應另做一份備份。</p></section>
    <p id="settings-status" role="status" aria-live="polite"></p>`;
  let info;
  const status = panel.querySelector('#settings-status');
  let reportKey='', reportParams={};
  const reportText = () => t(reportKey, {...reportParams, ...('error' in reportParams ? {error:errorMessage(reportParams.error)} : {})});
  const report = (message, params={}) => { reportKey=message; reportParams=params; status.textContent = reportText(); status.scrollIntoView({ block: 'nearest' }); };
  const language=panel.querySelector('#language'); language.value=getPreference(); language.onchange=()=>setLanguage(language.value);
  const templateLanguage=panel.querySelector('#template-language'), choice=panel.querySelector('#template-choice');
  templateLanguage.value=getLanguage();
  function renderTemplate() { const item=getTemplates(templateLanguage.value)[Number(choice.value)||0]; const preview=panel.querySelector('#template-preview'); preview.querySelector('h4').textContent=item.name; preview.querySelector('p').textContent=item.scenario; preview.querySelector('pre').textContent=item.text; }
  function renderTemplates() { choice.replaceChildren(...getTemplates(templateLanguage.value).map((item,i)=>{const option=document.createElement('option'); option.value=i; option.textContent=item.name; return option;})); renderTemplate(); }
  templateLanguage.onchange=renderTemplates; choice.onchange=renderTemplate; renderTemplates();
  onLanguageChange(()=>{ language.value=getPreference(); templateLanguage.value=getLanguage(); renderTemplates(); if(info)panel.querySelector('#file-ai-prompt').value=filePrompt(info.path); panel.querySelector('#file-exists').textContent=info ? t(info.exists ? '短句檔已建立。' : '尚未建立檔案：請先返回短句，按一次儲存。') : ''; status.textContent=reportText(); });
  async function refresh() {
    try {
      info = await invoke('storage_info');
      panel.querySelector('#data-path').textContent = info.path;
      panel.querySelector('#backup-path').textContent = info.backup;
      panel.querySelector('#file-exists').textContent = info.exists ? '短句檔已建立。' : '尚未建立檔案：請先返回短句，按一次儲存。';
      panel.querySelector('#file-ai-prompt').value = filePrompt(info.path);
      reportKey=''; status.textContent = '';
    } catch (error) { report(errorMessage(error)); }
  }
  panel.addEventListener('click', async event => {
    const button = event.target.closest('button[data-settings]'); if (!button || button.disabled) return;
    const action = button.dataset.settings;
    if (action === 'back') { onBack(); return; }
    button.disabled = true;
    try {
      if (!info) await refresh();
      if (action === 'template') { onAddTemplate(getTemplates(templateLanguage.value)[Number(choice.value)||0]); report('已加入草稿，請返回短句儲存。'); }
      if (action === 'folder') { await invoke('open_data_folder'); report('已開啟資料夾。'); }
      if (action === 'path') { await invoke('copy_text', { text: info.path }); report('已複製檔案路徑。'); }
      if (action === 'file-prompt') { await invoke('copy_text', { text: panel.querySelector('#file-ai-prompt').value }); report('已複製修改指令，請貼給你的 AI 並補上需求。'); }
      if (action === 'chat-prompt') {
        const saved = await invoke('get_snippets');
        await invoke('copy_text', { text: chatPrompt(saved) });
        report('已複製指令與已儲存短句，請貼給你的 AI。');
      }
      if (action === 'reload' && await onReload()) { await refresh(); report('已重新載入檔案，Alt+H 也已同步更新。'); }
      if (action === 'import') {
        const items = parseSnippetImport(panel.querySelector('#import-json').value);
        if (await askConfirmation({ title: '套用 AI 修改？', message: t('將用這 {count} 筆短句取代目前清單與未儲存草稿。原檔會備份為 snippets.json.bak。',{count:items.length}), confirmText: '套用並儲存' })) {
          await onImport(items); panel.querySelector('#import-json').value = ''; await refresh(); report('已套用並儲存 {count} 筆短句。',{count:items.length});
        }
      }
    } catch (error) { report('未完成：{error}',{error}); }
    finally { button.disabled = false; }
  });
  return { panel, refresh };
}
