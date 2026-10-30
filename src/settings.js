import { importPreview } from './import-preview.js';
import { createAutostartSetting } from './autostart-setting.js';
import { roleName } from './roles.js';
import { getShortcut, onShortcutChange, shortcutLabel } from './shortcut.js';
import { t, getLanguage, getPreference, setLanguage, onLanguageChange, errorMessage } from './i18n.js';
import { filePrompt, chatPrompt } from './ai-prompts.js';
import { getTemplates } from './template-locales.js';
import { parseSnippetImport, serializeSnippetExport } from './model.js';

export function createSettingsPage({ invoke, askConfirmation, onReload, onImport, onAddTemplate }) {
  const panel = document.createElement('section');
  panel.className = 'settings-panel'; panel.hidden = true;
  panel.innerHTML = `<header class="settings-heading"><div><h2>設定</h2><p>用你習慣的 AI 管理短句，不需要串接 API。</p></div></header>
    <section class="settings-card"><h3>快捷鍵設定</h3><p>預設 Alt+H，可更換組合；按住喚出、放開貼入的操作不變。</p><div class="shortcut-setting"><label for="shortcut-modifier">組合鍵</label><select id="shortcut-modifier"><option value="alt">Alt / Option</option><option value="altShift">Alt / Option + Shift</option><option value="ctrl">Ctrl</option><option value="ctrlShift">Ctrl + Shift</option></select><label for="shortcut-key">按鍵</label><select id="shortcut-key"></select></div><p id="shortcut-current"></p><div class="settings-buttons"><button data-settings="shortcut-save">儲存快捷鍵</button><button data-settings="shortcut-reset">恢復 Alt+H</button></div><p>選單開啟時再按一次設定的按鍵可取消。放開組合鍵後才會貼入；不使用單獨字母或常見的 Ctrl 複製、貼上、儲存組合。</p><p>Windows 會檢查快捷鍵是否被占用；macOS 請避開其他 App 使用的組合。</p></section>
    <section class="settings-card"><h3>介面語言</h3><select id="language" aria-label="介面語言"><option value="system">跟隨系統</option><option value="zh-TW">繁體中文</option><option value="zh-CN">简体中文</option><option value="en">English</option><option value="ja">日本語</option></select><p>內建短句隨語言切換；新增或自訂的短句保留原文。</p></section>
    <section class="settings-card"><h3>範本庫</h3><p>預覽並新增範本；不會取代現有短句。</p><select id="template-language" aria-label="範本語言"><option value="zh-TW">繁體中文</option><option value="zh-CN">简体中文</option><option value="en">English</option><option value="ja">日本語</option></select><select id="template-choice" aria-label="範本庫"></select><div id="template-preview"><h4></h4><p></p><pre></pre></div><button type="button" data-settings="template">新增此範本</button></section>
    <section class="settings-card"><h3>短句存在哪裡？</h3><p>以下是這台電腦的實際位置。名稱、內容與排序都存在同一份 JSON。</p><code id="data-path"></code><div class="settings-buttons"><button data-settings="folder">開啟資料夾</button><button data-settings="path">複製檔案路徑</button></div><p class="settings-backup">上一版備份：<code id="backup-path"></code></p><p id="file-exists"></p></section>
    <section class="settings-card"><h3>讓能操作本機檔案的 AI 直接修改</h3><p>適用於已取得此檔案存取權限的桌面／程式開發 AI 工具。一般網頁聊天不能僅憑路徑讀寫你的電腦。</p><ol><li>先在 before-you-do 儲存要保留的編輯。</li><li>複製下方指令，貼給你的 AI，再補上想修改的需求。</li><li>AI 修改檔案後，回到這裡按「重新載入檔案」。不要先按舊編輯畫面的儲存，以免蓋回舊內容。</li></ol><textarea id="file-ai-prompt" readonly aria-label="直接修改檔案的 AI 指令"></textarea><div class="settings-buttons"><button data-settings="file-prompt">複製修改指令</button><button data-settings="reload">重新載入檔案</button></div></section>
    <section class="settings-card"><h3>使用一般聊天 AI：複製 → 修改 → 套用</h3><p>複製的指令會包含目前已儲存的短句。貼給 AI 修改後，把完整 JSON 貼回下方；也接受 JSON 程式碼區塊。</p><div class="settings-buttons"><button data-settings="chat-prompt">複製聊天 AI 指令與短句</button></div><textarea id="import-json" spellcheck="false" placeholder='貼上 AI 回傳的完整 JSON，例如 [{"name":"短句名稱","text":"短句內容"}]' aria-label="AI 回傳的短句 JSON"></textarea><p>套用會取代整份清單與排序，並先備份原檔；確認前會檢查格式。未完成草稿也會被取代。</p><div class="settings-buttons"><button data-settings="import">檢查並套用 JSON</button></div></section>
    <section class="settings-card"><h3>怎麼請 AI 修改比較有效？</h3><ul><li><b>交代用途：</b>例如「補在開發需求後，請 AI 自主完成並回報」。</li><li><b>交代修改範圍：</b>例如「只改第三句，其他名稱、內容和順序不變」。</li><li><b>描述期待行為：</b>例如「先整理理解再做，不用逐步確認；遇到缺少權限時再問我」。</li><li><b>用實際任務試用：</b>觀察回覆與操作結果，再調整短句；提示詞無法保證 AI 一定完成或沒有錯誤。</li></ul><p>資料檔需保留 name、text，另可加入選填的 scenario（最多 1,000 字）。自訂情境不會自動翻譯，也不會一起貼入；未自訂時才使用內建範本的情境提示。</p></section>
    <section class="settings-card"><h3>備份與還原</h3><p>每次儲存會在目前角色的 .json.bak 檔保留上一版，不是完整歷史紀錄。還原前請完整結束 App，另存目前檔案，再將備份複製回上方顯示的短句路徑。外部 AI 修改前也應另做備份。</p></section>
    <p id="settings-status" role="status" aria-live="polite"></p>`;
  // Bonus-04: explicit saved-only JSON export, using the existing clipboard command.
  const autostart=createAutostartSetting(invoke);
  panel.querySelector('#language').closest('.settings-card').after(autostart.card);
  const exportCard=document.createElement('section');exportCard.className='settings-card';
  exportCard.innerHTML='<h3>匯出目前角色</h3><p>只複製目前角色已儲存的短句 JSON，包含情境與排序，不含未儲存草稿。</p><button type="button" data-settings="export-json">複製短句 JSON</button>';
  panel.querySelector('#import-json').closest('.settings-card').after(exportCard);
  const roleNote=document.createElement('p');roleNote.className='role-settings-note';panel.querySelector('.settings-heading').after(roleNote);
  let currentView='all';
  for(const card of panel.querySelectorAll('.settings-card'))card.dataset.settingsView=card===autostart.card||card.querySelector('#shortcut-modifier,#language')?'settings':'ai';
  function show(view){currentView=view;panel.dataset.view=view;for(const card of panel.querySelectorAll('.settings-card'))card.hidden=view!=='all'&&card.dataset.settingsView!==view;roleNote.hidden=view==='settings';renderHeading();}
  function renderHeading(){panel.querySelector('.settings-heading h2').textContent=t(currentView==='ai'?'AI 教學':'設定');panel.querySelector('.settings-heading p').textContent=t(currentView==='ai'?'用你習慣的 AI 管理短句，不需要串接 API。':'管理快捷鍵、介面語言、啟動與外觀選項。');}
  onLanguageChange(renderHeading);
  let currentRole='personal';
  function renderRoleNote(){roleNote.textContent=t('目前角色：{role}。匯入、重新載入與 AI 修改指令只針對此角色。',{role:roleName(currentRole,getLanguage())});}
  onLanguageChange(renderRoleNote);
  let info;
  const shortcutModifier=panel.querySelector('#shortcut-modifier'), shortcutKey=panel.querySelector('#shortcut-key');
  for(const key of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789','Space']){const option=document.createElement('option');option.value=key;option.textContent=key==='Space'?t('空白鍵'):key;shortcutKey.append(option);}
  function refreshShortcut(){const value=getShortcut();shortcutModifier.value=value.modifier;shortcutKey.value=value.key;panel.querySelector('#shortcut-current').textContent=t('目前快捷鍵：{shortcut}',{shortcut:shortcutLabel()});shortcutKey.querySelector('[value=Space]').textContent=t('空白鍵');}
  onShortcutChange(refreshShortcut);refreshShortcut();
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
    await autostart.refresh();
    try {
      currentRole=await invoke('get_role');renderRoleNote();
      info = await invoke('storage_info');
      panel.querySelector('#data-path').textContent = info.path;
      panel.querySelector('#backup-path').textContent = info.backup;
      panel.querySelector('#file-exists').textContent = info.exists ? '短句檔已建立。' : '尚未建立檔案：請先返回短句，按一次儲存。';
      panel.querySelector('#file-ai-prompt').value = filePrompt(info.path);
      refreshShortcut(); reportKey=''; status.textContent = '';
    } catch (error) { report(errorMessage(error)); }
  }
  panel.addEventListener('click', async event => {
    const button = event.target.closest('button[data-settings]'); if (!button || button.disabled) return;
    const action = button.dataset.settings;
    button.disabled = true;
    try {
      if (!info) await refresh();
      if (action === 'template') { onAddTemplate(getTemplates(templateLanguage.value)[Number(choice.value)||0]); report('已加入草稿，請返回短句儲存。'); }
      if(action==='shortcut-save'||action==='shortcut-reset'){
        const candidate=action==='shortcut-reset'?{modifier:'alt',key:'H'}:{modifier:shortcutModifier.value,key:shortcutKey.value};
        await invoke('save_shortcut',{shortcut:candidate});refreshShortcut();report('快捷鍵已儲存，下次啟動也會沿用。');
      }
      if(action==='export-json'){
        const saved=await invoke('get_snippets');
        await invoke('copy_text',{text:serializeSnippetExport(saved)});
        report('已複製目前角色的短句 JSON；未儲存草稿未包含在內。');
      }
      if (action === 'folder') { await invoke('open_data_folder'); report('已開啟資料夾。'); }
      if (action === 'path') { await invoke('copy_text', { text: info.path }); report('已複製檔案路徑。'); }
      if (action === 'file-prompt') { await invoke('copy_text', { text: panel.querySelector('#file-ai-prompt').value }); report('已複製修改指令，請貼給你的 AI 並補上需求。'); }
      if (action === 'chat-prompt') {
        const saved = await invoke('get_snippets');
        await invoke('copy_text', { text: chatPrompt(saved) });
        report('已複製指令與已儲存短句，請貼給你的 AI。');
      }
      if (action === 'reload' && await onReload()) { await refresh(); report('已重新載入檔案，快捷選單也已同步更新。'); }
      if (action === 'import') {
        const items = parseSnippetImport(panel.querySelector('#import-json').value);
        if (await askConfirmation({ title: '套用 AI 修改？', message: importPreview(items,(await invoke('get_snippets')).length,getLanguage()), confirmText: '套用並儲存' })) {
          await onImport(items); panel.querySelector('#import-json').value = ''; await refresh(); report('已套用並儲存 {count} 筆短句。',{count:items.length});
        }
      }
    } catch (error) { report('未完成：{error}',{error}); }
    finally { button.disabled = false; }
  });
  return { panel, refresh, show };
}
