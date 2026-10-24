import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { prepareSnippetSave, reorderSnippets } from './model.js';
import './style.css';
import { askConfirmation } from './dialog.js';
import { t, getLanguage, onLanguageChange, bindTranslations, errorMessage } from './i18n.js';
import { findTemplate } from './template-locales.js';
import { createSettingsPage } from './settings.js';
const templateInfo = item => findTemplate(item, getLanguage());

const root = document.querySelector('#app');
if (/Win/i.test(navigator.platform)) document.body.classList.add('windows');
const picker = new URLSearchParams(location.search).has('picker');
const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  text: '<path d="M5 6h14M12 6v13M8 19h8"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  minimize: '<path d="M5 12h14"/>',
  maximize: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  glass: '<path d="M5 4h14l-2 16H7L5 4Z"/><path d="M6 9h12M10 12l-1 5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] ?? paths.text}</svg>`;
const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
let appearance;
try { appearance = JSON.parse(localStorage.getItem('quicksay.appearance')) || {}; } catch { appearance = {}; }
const legacyAppearance = appearance.version !== 2;
appearance = { version: 2, theme: ['light', 'dark', 'system'].includes(appearance.theme) ? appearance.theme : 'light', transparency: Math.min(85, Math.max(15, legacyAppearance ? 35 : (Number(appearance.transparency) || 35))) };
localStorage.setItem('quicksay.appearance', JSON.stringify(appearance));
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
async function applyAppearance(save = false) {
  const dark = appearance.theme === 'dark' || (appearance.theme === 'system' && systemTheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--glass-alpha', String(.48 + (100 - appearance.transparency) / 100 * .22));
  if (save) localStorage.setItem('quicksay.appearance', JSON.stringify(appearance));
  try { await invoke('configure_glass', { dark, transparency: appearance.transparency }); } catch (error) { console.warn('Native glass effect:', error); }
}
await listen('window-layout', event => document.documentElement.classList.toggle('maximized', !!event.payload));
await applyAppearance();
systemTheme.addEventListener('change', () => applyAppearance());
window.addEventListener('storage', e => { if (e.key === 'quicksay.appearance') { try { appearance = JSON.parse(e.newValue); applyAppearance(); } catch {} } });

if (picker) {
  document.body.classList.add('picker');
  const box = el('main', 'picker-card');
  box.innerHTML = `<header class="picker-header"><span class="app-mark">${icon('text')}</span><div><strong>快捷提示詞</strong></div><span class="shortcut"><kbd>Alt / ⌥</kbd><kbd>H</kbd></span></header><div class="picker-label">我的短句</div>`;
  const list = el('div', 'picker-list'); box.append(list);
  const addRow = el('div', 'picker-row picker-add'); addRow.innerHTML = `<span class="item-icon">${icon('plus')}</span><div class="picker-content"><strong>新增快捷提示詞</strong></div>`; box.append(addRow);
  const footer = el('footer', 'picker-footer'); footer.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> 選擇</span><span>放開 <kbd>Alt / ⌥</kbd> 貼入</span><span><kbd>Esc</kbd> 取消</span>'; box.append(footer); root.append(box);
  let latestState;
  function render(state) { latestState = state;
    list.replaceChildren();
    state.items.forEach((item, i) => {
      const row = el('div', `picker-row ${i === state.selected ? 'active' : ''}`);
      const badge = el('span', 'item-icon'); badge.innerHTML = icon('text'); row.append(badge);
      const content = el('div', 'picker-content'); content.append(el('strong', '', item.name), el('p', '', templateInfo(item)?.scenario ?? item.text)); row.append(content, el('span', 'number', String(i + 1).padStart(2, '0'))); list.append(row);
    });
    addRow.classList.toggle('active', state.selected === state.items.length);
    footer.children[1].innerHTML = `${t('放開')} <kbd>Alt / ⌥</kbd> ${t(state.selected === state.items.length ? '新增' : '貼入')}`;
    list.children[state.selected]?.scrollIntoView({ block: 'nearest' });
  }
  await listen('picker-state', event => render(event.payload));
  render(await invoke('picker_state'));
  onLanguageChange(() => { if (latestState) render(latestState); });
} else {
  let items = [], selected = 0, dirty = false;
  root.innerHTML = `<div class="app-shell"><div class="windowbar"><div class="window-brand"><span class="tiny-mark">${icon('text')}</span>Before You Do<span class="window-subtitle">你的對話捷徑</span></div><div class="window-controls"><button aria-label="最小化" data-action="minimize">${icon('minimize')}</button><button aria-label="最大化或還原" data-action="maximize">${icon('maximize')}</button><button aria-label="收起到系統匣" data-action="close">${icon('close')}</button></div></div><main class="manager"><aside><div class="library-heading"><h1>短句資料庫</h1><span id="library-count">0</span></div><label class="search-box" for="search">${icon('search')}<input id="search" placeholder="搜尋短句" autocomplete="off"><kbd>/</kbd></label><div class="section-label">我的短句</div><div id="snippets"></div><button id="add" class="add">${icon('plus')}新增短句</button><div class="sidebar-foot">${icon('lock')}只儲存在這台電腦</div></aside><section class="workspace"><header class="editor-heading"><div><div class="eyebrow">YOUR WORDS, WITHIN REACH</div><h2>把常說的話，留在手邊。</h2></div><span id="native-status" class="status-pill" role="status"><i></i><span>準備中</span></span></header><div id="native-error" role="status" hidden></div><button id="retry" class="secondary" hidden>重新啟用快捷鍵</button><form id="editor"><div class="editor-card"><div class="field-heading"><span class="item-icon">${icon('text')}</span><label for="name">短句名稱</label><span class="plain-badge">純文字</span></div><input id="name" maxlength="100" placeholder="為這句話取個名字"><div class="content-label"><label for="text">短句內容</label><span id="count"></span></div><textarea id="text" maxlength="20000" placeholder="寫下你想快速補進對話的文字…"></textarea><div class="editor-bottom"><span>貼入游標位置，不會送出訊息</span><span id="save-status" role="status">已儲存</span></div></div><div class="form-actions"><button type="button" id="delete" class="delete">${icon('trash')}刪除</button><div><span class="save-hint">Ctrl / ⌘ S</span><button class="primary" type="submit">${icon('check')}儲存短句</button></div></div></form><div class="usage-bar"><span class="shortcut"><kbd>Alt / ⌥</kbd><kbd>H</kbd></span><span>按住喚出，用 ↑ ↓ 選句，放開即貼上</span></div><div class="appearance-bar"><div class="glass-setting"><label for="transparency">${icon('glass')}玻璃透明度</label><input type="range" id="transparency" min="15" max="85" step="1"><output id="transparency-value" for="transparency"></output></div><select id="theme" aria-label="外觀主題"><option value="light">淺色</option><option value="dark">深色</option><option value="system">跟隨系統</option></select></div><footer>每次貼入會取代剪貼簿內容。<span>BEFORE YOU DO · 0.2</span></footer></section></main></div>`;
  const scenarioBox = el('div', 'scenario-box'); scenarioBox.hidden = true;
  scenarioBox.innerHTML = '<strong>適用情境</strong><p></p><small></small>';
  document.querySelector('#name').after(scenarioBox);
  function renderScenario() { const info = templateInfo(items[selected]); scenarioBox.hidden = !info; if (info) { scenarioBox.querySelector('p').textContent = info.scenario; scenarioBox.querySelector('small').textContent = info.source; scenarioBox.querySelector('small').title = info.url ?? ''; } }
  const name = document.querySelector('#name'), text = document.querySelector('#text'), search = document.querySelector('#search'), saveStatus = document.querySelector('#save-status');
  let statusKey = '已儲存', statusParams = {}, statusError = null;
  function setSaveError(error) { statusError=error; saveStatus.textContent=errorMessage(error); }
  function setSaveStatus(key, params = {}) { statusError=null; statusKey = key; statusParams = params; saveStatus.textContent = t(key, params); }
  const workspace = document.querySelector('.workspace');
  const settingsButton = el('button', 'settings-link', '設定與 AI 教學');
  settingsButton.type = 'button'; settingsButton.setAttribute('aria-pressed', 'false');
  document.querySelector('.sidebar-foot').before(settingsButton);
  function showLibrary() { settings.panel.hidden = true; workspace.hidden = false; settingsButton.setAttribute('aria-pressed', 'false'); }
  const settings = createSettingsPage({ invoke, askConfirmation, onBack: showLibrary, onAddTemplate: item => { if (items.length >= 100) throw new Error('最多 100 句。'); stash(); items.push({name:item.name,text:item.text}); selected=items.length-1; dirty=true; search.value=''; render(); setSaveStatus('尚未儲存'); },
    onReload: async () => {
      if (dirty && !await askConfirmation({title: '重新載入檔案？', message: '將以檔案內容取代目前編輯與未儲存草稿。請確認要保留的內容已儲存或另行備份。', confirmText: '重新載入'})) return false;
      const refreshed = await invoke('reload_snippets'); items = refreshed; selected = 0; dirty = false; render(); setSaveStatus('已從檔案載入'); return true;
    },
    onImport: async imported => { await invoke('save_snippets', {items: imported}); items = imported; selected = 0; dirty = false; search.value = ''; render(); setSaveStatus('已儲存'); },
  });
  document.querySelector('.manager').append(settings.panel);
  settingsButton.onclick = async () => { stash(); workspace.hidden = true; settings.panel.hidden = false; settingsButton.setAttribute('aria-pressed', 'true'); await settings.refresh(); };
  function stash() { if (items[selected]) { items[selected].name = name.value; items[selected].text = text.value; } }
  let dragging = -1;
  const sortTools = el('div', 'sort-tools');
  sortTools.innerHTML = '<span>拖曳排序</span><button type="button" aria-label="上移短句" title="上移選取短句">↑</button><button type="button" aria-label="下移短句" title="下移選取短句">↓</button>';
  document.querySelector('#snippets').before(sortTools);
  const [moveUp, moveDown] = sortTools.querySelectorAll('button');
  function moveSnippet(from, to) {
    if (search.value.trim() || from === to || to < 0 || to >= items.length) return;
    stash();
    const result = reorderSnippets(items, from, to, selected);
    items = result.items; selected = result.selected; dragging = -1; dirty = true;
    render(); setSaveStatus('順序已調整，儲存後生效');
  }
  moveUp.onclick = () => { moveSnippet(selected, selected - 1); document.querySelector('.snippet.selected')?.scrollIntoView({block:'nearest'}); };
  moveDown.onclick = () => { moveSnippet(selected, selected + 1); document.querySelector('.snippet.selected')?.scrollIntoView({block:'nearest'}); };
  function renderList() {
    const list = document.querySelector('#snippets'); list.replaceChildren(); const query = search.value.trim().toLocaleLowerCase();
    document.querySelector('#library-count').textContent = items.length;
    moveUp.disabled = !!query || selected === 0; moveDown.disabled = !!query || selected === items.length - 1;
    sortTools.querySelector('span').textContent = query ? '清除搜尋後可排序' : '拖曳排序';
    items.forEach((item, i) => {
      if (query && !(item.name + ' ' + item.text).toLocaleLowerCase().includes(query)) return;
      const button = el('button', `snippet ${i === selected ? 'selected' : ''}`);
      button.draggable = !query;
      button.ondragstart = event => { if (query) { event.preventDefault(); return; } stash(); dragging = i; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(i)); button.classList.add('dragging'); };
      button.ondragover = event => { if (dragging < 0 || query) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const below = event.clientY > button.getBoundingClientRect().top + button.offsetHeight / 2; button.classList.toggle('drop-after', below); button.classList.toggle('drop-before', !below); };
      button.ondragleave = () => button.classList.remove('drop-before', 'drop-after');
      button.ondragend = () => { dragging = -1; document.querySelectorAll('.snippet').forEach(row => row.classList.remove('dragging', 'drop-before', 'drop-after')); };
      button.ondrop = event => { if (dragging < 0 || query) return; event.preventDefault(); const from = dragging; const below = event.clientY > button.getBoundingClientRect().top + button.offsetHeight / 2; let to = i + (below ? 1 : 0); if (from < to) to--; button.classList.remove('drop-before', 'drop-after'); moveSnippet(from, to); dragging = -1; };
      const badge = el('span', 'item-icon'); badge.innerHTML = icon('text');
      const content = el('span', 'snippet-info'); content.append(el('strong', '', item.name || '未命名短句'), el('span', '', item.text || '新增你的常用文字…'));
      button.append(badge, content); button.onclick = () => { stash(); selected = i; render(); showLibrary(); }; list.append(button);
    });
    if (!list.children.length) list.append(el('p', 'empty-search', '沒有符合的短句'));
  }
  function render() { renderList(); renderScenario(); name.value = items[selected]?.name ?? ''; text.value = items[selected]?.text ?? ''; document.querySelector('#count').textContent = t('{count} 字', {count:text.value.length}); }
  function changed() { stash(); renderScenario(); dirty = true; setSaveStatus('尚未儲存'); document.querySelector('#count').textContent = t('{count} 字', {count:text.value.length}); renderList(); }
  name.oninput = text.oninput = changed; search.oninput = renderList;
  function addSnippet() { stash(); if (items.length >= 100) return askConfirmation({title:t('最多 100 句。'),message:'',notice:true,confirmText:t('知道了')}); search.value = ''; items.push({ name: t('新短句'), text: '' }); selected = items.length - 1; dirty = true; render(); showLibrary(); setSaveStatus('尚未儲存'); name.focus(); name.select(); }
  document.querySelector('#add').onclick = addSnippet;
  async function consumeNewSnippet() { if (items.length && await invoke('consume_new_snippet')) addSnippet(); }
  await listen('new-snippet', consumeNewSnippet);
  document.querySelector('#delete').onclick = async () => { if (items.length === 1) { await askConfirmation({title: '請至少保留一句短句', message: '先新增另一句短句，再刪除這一句。', confirmText: '知道了', notice: true}); return; } stash(); const target = selected; if (!await askConfirmation({title: '刪除短句？', message: t('確定要刪除「{name}」嗎？刪除後需按「儲存短句」才會生效。', {name:items[target].name || t('未命名短句')}), confirmText: '刪除短句', danger: true})) return; items.splice(target, 1); selected = Math.min(target, items.length - 1); dirty = true; render(); setSaveStatus('尚未儲存'); };
  document.querySelector('#editor').onsubmit = async e => { e.preventDefault(); stash(); try { const result = prepareSnippetSave(items); await invoke('save_snippets', { items: result.saved }); items = result.editorItems; dirty = result.draftCount > 0; render(); setSaveStatus(result.draftCount ? '已儲存 · {count} 筆空白草稿尚未儲存' : '已儲存', {count:result.draftCount}); } catch (error) { setSaveError(error); } };
  async function nativeStatus() { const status = await invoke('native_status'); const preview = status.startsWith('外觀預覽'); const ready = status.startsWith('已啟用') || preview; if (preview) document.querySelector('.workspace>footer').firstChild.textContent = t('外觀預覽 · 修改不會影響原有短句。'); document.querySelector('#native-status').classList.toggle('unavailable', !ready); document.querySelector('#native-status span').textContent = t(preview ? '外觀預覽' : ready ? '快捷鍵已啟用' : '快捷鍵需設定'); document.querySelector('#native-status').title = t(status); document.querySelector('#native-error').hidden = ready; document.querySelector('#native-error').textContent = ready ? '' : errorMessage(status); document.querySelector('#retry').hidden = ready; }
  document.querySelector('#retry').onclick = async () => { await invoke('restart_keyboard'); await nativeStatus(); };
  async function hide() { if (!dirty || await askConfirmation({title: '收起視窗？', message: '目前有尚未儲存的修改。收起後程式仍會執行，草稿會保留在此視窗中。', confirmText: '收起視窗'})) await invoke('hide_manager'); }
  await listen('native-status', nativeStatus); await listen('save-before-hide', hide);
  const bar = document.querySelector('.windowbar');
  bar.onpointerdown = e => { if (e.button === 0 && !e.target.closest('button')) invoke('window_action', { action: 'drag' }); };
  bar.ondblclick = e => { if (!e.target.closest('button')) invoke('window_action', { action: 'maximize' }); };
  document.querySelectorAll('[data-action]').forEach(button => { button.onclick = () => button.dataset.action === 'close' ? hide() : invoke('window_action', { action: button.dataset.action }); });
  const transparency = document.querySelector('#transparency'), theme = document.querySelector('#theme');
  transparency.value = appearance.transparency; theme.value = appearance.theme;
  document.querySelector('#transparency-value').value = `${appearance.transparency}%`;
  let effectTimer;
  transparency.oninput = () => { appearance.transparency = Number(transparency.value); document.querySelector('#transparency-value').value = `${appearance.transparency}%`; clearTimeout(effectTimer); effectTimer = setTimeout(() => applyAppearance(true), 70); };
  theme.onchange = () => { appearance.theme = theme.value; applyAppearance(true); };
  document.addEventListener('keydown', e => { if (document.querySelector('dialog[open]')) return; if (!settings.panel.hidden) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') e.preventDefault(); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); document.querySelector('#editor').requestSubmit(); } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); search.focus(); } });
  onLanguageChange(() => { renderList(); renderScenario(); document.querySelector('#count').textContent=t('{count} 字',{count:text.value.length}); if(statusError) setSaveError(statusError); else setSaveStatus(statusKey,statusParams); nativeStatus(); });
  items = await invoke('get_snippets'); render(); setSaveStatus('已儲存'); await nativeStatus(); await consumeNewSnippet();
}












bindTranslations(document.body);
const syncNativeLanguage = () => invoke('set_ui_language', {language:getLanguage()}).catch(console.warn);
onLanguageChange(syncNativeLanguage);
await syncNativeLanguage();
document.documentElement.lang = getLanguage();
