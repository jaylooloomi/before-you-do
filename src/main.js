import { characterCount } from './unicode.js';
import { localizedSnippet } from './localized-snippet.js';
import { scenarioHint } from './scenario-hint.js';
import { savedSnapshot } from './saved-snapshot.js';
import { usageHelp } from './usage-help.js';
import { matchesSnippetQuery } from './snippet-search.js';
import appIcon from './assets/app-icon.png';
import { matchesShortcutEvent } from './shortcut-match.js';
import { getShortcut, initializeShortcut, renderShortcut, onShortcutChange, modifierLabel, keyLabel, shortcutLabel } from './shortcut.js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { prepareSnippetSave, reorderSnippets, savedVersions, snippetIssues } from './model.js';
import './style.css';
import { askConfirmation } from './dialog.js';
import { t, getLanguage, onLanguageChange, bindTranslations, errorMessage } from './i18n.js';
import { findTemplate } from './template-locales.js';
import { createSettingsPage } from './settings.js';
import { roles, roleName, roleDescription, getRoleDefaults, findRoleTemplate } from './roles.js';
async function startApp() {
const templateInfo = item => {
  if(item&&Object.hasOwn(item,'scenario'))return {scenario:item.scenario,source:t('自訂情境')};
  return findTemplate(item,getLanguage())??findRoleTemplate(item,getLanguage());
};

const root = document.querySelector('#app');
if (/Win/i.test(navigator.platform)) document.body.classList.add('windows');
const picker = new URLSearchParams(location.search).has('picker');
const paths = {
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1L9 21h6l.5-2.5 2-1 2 .5 2-3-1.5-2v-3L21.5 9l-2-3-2 .5-2-1L15 3Z"/>',
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

await initializeShortcut();

if (picker) {
  document.body.classList.add('picker');
  const box = el('main', 'picker-card');
  box.innerHTML = `<header class="picker-header"><span class="app-mark brand-mark"><img src="${appIcon}" alt=""></span><div><strong>快捷提示詞</strong></div><span class="shortcut"><kbd>Alt / ⌥</kbd><kbd>H</kbd></span></header><div class="picker-label">我的短句</div>`;
  const list = el('div', 'picker-list'); box.append(list);
  const addRow = el('div', 'picker-row picker-add'); addRow.innerHTML = `<span class="item-icon">${icon('plus')}</span><div class="picker-content"><strong>新增快捷提示詞</strong></div>`; box.append(addRow);
  const settingsRow=el('div','picker-row picker-settings');settingsRow.innerHTML=`<span class="item-icon">${icon('settings')}</span><div class="picker-content"><strong>設定</strong></div>`;box.append(settingsRow);
  const footer = el('footer', 'picker-footer'); footer.innerHTML = '<span><kbd>←</kbd><kbd>→</kbd> 角色 <kbd>↑</kbd><kbd>↓</kbd> 選擇</span><span>放開 <kbd>Alt / ⌥</kbd> 貼入</span><span><kbd>Esc</kbd> 取消</span>'; box.append(footer); root.append(box);
  const roleLabel=box.querySelector('.picker-label');roleLabel.classList.add('picker-rolebar');
  roleLabel.innerHTML='<span class="role-neighbor previous"><kbd>←</kbd><span></span></span><span class="picker-role-current"><span class="picker-role-mark"></span><strong></strong><small></small></span><span class="role-neighbor next"><span></span><kbd>→</kbd></span>';
  let activeRole=await invoke('get_role');
  function renderRoleLabel(){
    const index=Math.max(0,roles.findIndex(role=>role.id===activeRole));
    roleLabel.querySelector('.previous>span').textContent=roleName(roles[(index+roles.length-1)%roles.length].id,getLanguage());
    roleLabel.querySelector('.next>span').textContent=roleName(roles[(index+1)%roles.length].id,getLanguage());
    roleLabel.querySelector('strong').textContent=roleName(activeRole,getLanguage());
    roleLabel.querySelector('.picker-role-mark').textContent=roles[index].mark;
    roleLabel.querySelector('small').textContent=(index+1)+' / '+roles.length;
  }
  let latestState;
  function render(state) { latestState = state;
    if(state.role)activeRole=state.role;renderRoleLabel();
    list.replaceChildren();
    state.items.forEach((savedItem, i) => {
      const item=localizedSnippet(savedItem,activeRole,getLanguage());
      const row = el('div', `picker-row ${i === state.selected ? 'active' : ''}`);
      const badge = el('span', 'item-icon'); badge.innerHTML = icon('text'); row.append(badge);
      const content = el('div', 'picker-content'); content.append(el('strong', '', item.name), el('p', '', activeRole === 'agent' ? item.text : (templateInfo(item)?.scenario || item.text))); row.append(content, el('span', 'number', String(i + 1).padStart(2, '0'))); list.append(row);
    });
    addRow.classList.toggle('active', state.selected === state.items.length);
    settingsRow.classList.toggle('active',state.selected === state.items.length+1);
    footer.children[1].innerHTML = `${t('放開')} <kbd>${modifierLabel()}</kbd> ${t(state.selected === state.items.length+1 ? '開啟' : state.selected === state.items.length ? '新增' : '貼入')}`;
    list.children[state.selected]?.scrollIntoView({ block: 'nearest' });
  }
  await listen('picker-state', event => render(event.payload));
  await listen('role-changed',event=>{activeRole=event.payload;renderRoleLabel();});
  onLanguageChange(renderRoleLabel);renderRoleLabel();
  render(await invoke('picker_state'));
  onLanguageChange(() => { if (latestState) render(latestState); });
  onShortcutChange(() => { if(latestState)render(latestState); });
} else {
  let items = [], selected = 0, dirty = false, versions = new Map(), saveIssues = [];
  let activeRole = await invoke('get_role'), switchingRole = false;
  const roleSessions = new Map();
  let roleSync=Promise.resolve(), saveTask=Promise.resolve(), saving=false;
  // Bonus-05: snapshots never share objects with editable drafts, including cached roles.
  let loadedSnapshot;
  async function snapshotFor(saved){return savedSnapshot(saved,(await invoke('storage_info')).exists);}
  root.innerHTML = `<div class="app-shell"><div class="windowbar"><div class="window-brand"><span class="tiny-mark brand-mark"><img src="${appIcon}" alt=""></span>before-you-do<span class="window-subtitle">你的對話捷徑</span></div><div class="window-controls"><button aria-label="最小化" data-action="minimize">${icon('minimize')}</button><button aria-label="收起到系統匣" data-action="close">${icon('close')}</button></div></div><main class="manager"><aside><div class="library-heading"><h1>短句資料庫</h1><span id="library-count">0</span></div><label class="search-box" for="search">${icon('search')}<input id="search" title="可輸入多個關鍵字，搜尋名稱、內容與情境。" placeholder="搜尋短句" autocomplete="off"><kbd>/</kbd></label><div class="section-label">我的短句</div><div id="snippets"></div><button id="add" class="add">${icon('plus')}新增短句</button><div class="sidebar-foot">${icon('lock')}只儲存在這台電腦</div></aside><section class="workspace"><header class="editor-heading"><div><div class="eyebrow">YOUR WORDS, WITHIN REACH</div><h2>把常說的話，留在手邊。</h2></div><span id="native-status" class="status-pill" role="status"><i></i><span>準備中</span></span></header><div id="native-error" role="status" hidden></div><button id="retry" class="secondary" hidden>重新啟用快捷鍵</button><form id="editor"><div class="editor-card"><div class="field-heading"><span class="item-icon">${icon('text')}</span><label for="name">短句名稱</label><span class="plain-badge">純文字</span></div><input id="name" placeholder="為這句話取個名字"><div class="content-label"><label for="text">短句內容</label><span id="count"></span></div><textarea id="text" placeholder="寫下你想快速補進對話的文字…"></textarea><div class="editor-bottom"><span>貼入游標位置，不會送出訊息</span><span id="save-status" role="status">已儲存</span></div></div><div class="form-actions"><button type="button" id="delete" class="delete">${icon('trash')}刪除</button><div><span class="save-hint">Ctrl / ⌘ S</span><button class="primary" type="submit">${icon('check')}儲存短句</button></div></div></form><div class="usage-bar"><span class="shortcut"><kbd>Alt / ⌥</kbd><kbd>H</kbd></span><span>按住喚出，用 ↑ ↓ 選句，放開即貼上</span></div><div class="appearance-bar"><div class="glass-setting"><label for="transparency">${icon('glass')}玻璃透明度</label><input type="range" id="transparency" min="15" max="85" step="1"><output id="transparency-value" for="transparency"></output></div><select id="theme" aria-label="外觀主題"><option value="light">淺色</option><option value="dark">深色</option><option value="system">跟隨系統</option></select></div><footer>每次貼入會取代剪貼簿內容。<span>before-you-do · 0.4.1</span></footer></section></main></div>`;
  const roleCards = el('div','role-cards');roleCards.setAttribute('role','group');roleCards.setAttribute('aria-label',t('選擇角色'));
  const roleSwitcher=el('div','role-switcher');
  const previousRoles=el('button','role-scroll','‹'),nextRoles=el('button','role-scroll','›');
  previousRoles.type=nextRoles.type='button';
  roleSwitcher.append(previousRoles,roleCards,nextRoles);
  document.querySelector('.editor-heading').before(roleSwitcher);
  const saveOverview=el('div','role-save-overview');saveOverview.setAttribute('role','status');roleSwitcher.after(saveOverview);
  const issuePanel=el('div','save-issues');issuePanel.setAttribute('aria-label',t('待完成的短句'));issuePanel.hidden=true;document.querySelector('.form-actions').before(issuePanel);
  const saveScope=el('div','save-scope');document.querySelector('.form-actions').before(saveScope);
  function unsavedRoleIds(){return roles.filter(role=>role.id===activeRole?dirty:roleSessions.get(role.id)?.dirty).map(role=>role.id);}
  function renderSaveOverview(){
    const pending=unsavedRoleIds(),others=pending.filter(id=>id!==activeRole);
    saveOverview.replaceChildren(el('span','',t('目前角色：{role} · {status}',{role:roleName(activeRole,getLanguage()),status:t(dirty?'尚未儲存':'已儲存')})));
    if(others.length){saveOverview.append(el('span','',t('其他未儲存角色：')));for(const id of others){const button=el('button','',roleName(id,getLanguage()));button.type='button';button.onclick=()=>switchRole(id);saveOverview.append(button);}}
    for(const button of roleCards.querySelectorAll('[data-role]')){const pendingRole=pending.includes(button.dataset.role);button.classList.toggle('has-unsaved',pendingRole);button.title=roleDescription(roles.find(r=>r.id===button.dataset.role),getLanguage())+(pendingRole?' · '+t('尚未儲存'):'');}
    saveScope.textContent=t('儲存目前角色的完整短句；未完成草稿會保留。');
  }
  function renderIssues(){
    issuePanel.hidden=!saveIssues.length;issuePanel.replaceChildren();
    if(saveIssues.length)issuePanel.append(el('strong','',t('待完成的短句')));
    for(const issue of saveIssues){const button=el('button','save-issue');button.type='button';
      const fields=issue.fields.map(f=>t(f.field==='name'?'短句名稱':f.field==='text'?'短句內容':'適用情境')+'：'+t(f.reason==='required'?'必填':'超過字數上限')).join('、');
      button.textContent=t('第 {index} 筆「{name}」：{fields}。{retained}',{index:issue.index+1,name:items[issue.index]?.name||t('未命名短句'),fields,retained:t(issue.retained?'保留上次已儲存版本':'僅保留於草稿，尚未加入快捷選單')});
      button.onclick=()=>{stash();selected=issue.index;search.value='';render();showLibrary();const field=document.querySelector('#'+issue.fields[0].field);field.focus();field.scrollIntoView({block:'nearest'});};issuePanel.append(button);
    }
    for(const field of ['name','text','scenario'])document.querySelector('#'+field).setAttribute('aria-invalid',String(saveIssues.some(issue=>issue.index===selected&&issue.fields.some(f=>f.field===field))));
  }
  function refreshIssues(){if(saveIssues.length)saveIssues=items.flatMap((item,index)=>{const fields=snippetIssues(item);return fields.length?[{index,name:item.name,fields,retained:versions.has(item)}]:[]});}

  function updateRoleScroll(){previousRoles.disabled=roleCards.scrollLeft<2;nextRoles.disabled=roleCards.scrollLeft+roleCards.clientWidth>=roleCards.scrollWidth-2;}
  function scrollRoles(direction){roleCards.scrollBy({left:direction*Math.max(156,roleCards.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  previousRoles.onclick=()=>scrollRoles(-1);nextRoles.onclick=()=>scrollRoles(1);
  roleCards.addEventListener('scroll',updateRoleScroll,{passive:true});
  new ResizeObserver(updateRoleScroll).observe(roleCards);
  roleCards.addEventListener('wheel',event=>{
    if(event.ctrlKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?roleCards.clientWidth:1);
    if((delta<0&&roleCards.scrollLeft>0)||(delta>0&&roleCards.scrollLeft+roleCards.clientWidth<roleCards.scrollWidth-1)){
      event.preventDefault();roleCards.scrollLeft+=delta;
    }
  },{passive:false});
  roleCards.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...roleCards.querySelectorAll('button')],index=buttons.indexOf(event.target);if(index<0)return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowLeft'?-1:1)));
    buttons[next]?.focus({preventScroll:true});buttons[next]?.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  function renderRoles(){
    roleCards.replaceChildren(...roles.map(role=>{
      const button=el('button','role-card'+(role.id===activeRole?' selected':''));
      button.type='button';button.dataset.role=role.id;button.setAttribute('aria-pressed',String(role.id===activeRole));button.disabled=switchingRole;
      const mark=el('span','role-mark',role.mark);mark.setAttribute('aria-hidden','true');
      const content=el('span','role-card-content');content.append(el('strong','',roleName(role.id,getLanguage())),el('small','',roleDescription(role,getLanguage())));
      button.append(mark,content);button.title=roleDescription(role,getLanguage());button.onclick=()=>switchRole(role.id);return button;
    }));
    roleCards.setAttribute('aria-label',t('選擇角色'));
    document.querySelector('aside .section-label').textContent=roleName(activeRole,getLanguage());
    previousRoles.setAttribute('aria-label',t('向左捲動角色'));nextRoles.setAttribute('aria-label',t('向右捲動角色'));
    previousRoles.title=t('向左捲動角色');nextRoles.title=t('向右捲動角色');
    roleCards.querySelector('[aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});
    renderSaveOverview();requestAnimationFrame(updateRoleScroll);
  }
  async function switchRole(id){
    await saveTask;
    if(switchingRole||id===activeRole)return;
    stash();
    roleSessions.set(activeRole,{items,selected,dirty,versions,saveIssues,loadedSnapshot,query:search.value,statusKey,statusParams,statusError});
    switchingRole=true;renderRoles();
    document.querySelector('#editor').inert=true;document.querySelector('aside').inert=true;
    try{
      const saved=await invoke('switch_role',{role:id,defaults:getRoleDefaults(id,getLanguage())});
      activeRole=id;
      const cached=roleSessions.get(id);
      loadedSnapshot=cached?.loadedSnapshot??await snapshotFor(saved);items=cached?.items??saved;versions=cached?.versions??savedVersions(items);saveIssues=cached?.saveIssues??[];selected=cached?.selected??0;dirty=cached?.dirty??false;search.value=cached?.query??'';
      statusKey=cached?.statusKey??'已儲存';statusParams=cached?.statusParams??{};statusError=cached?.statusError??null;
      render();if(statusError)setSaveError(statusError);else setSaveStatus(statusKey,statusParams);
    }catch(error){setSaveError(error);}
    finally{switchingRole=false;document.querySelector('#editor').inert=false;document.querySelector('aside').inert=false;renderRoles();}
  }
  const scenarioBox = el('div', 'scenario-box scenario-editor');
  scenarioBox.innerHTML = '<label for="scenario">適用情境（選填）</label><textarea id="scenario" rows="2" placeholder="例如：需求已確定，希望 AI 實作後測試並回報。"></textarea><small></small>';
  const scenario=scenarioBox.querySelector('#scenario');let scenarioEdited=false;
  document.querySelector('#name').after(scenarioBox);
  function renderScenario() {
    const item=items[selected],displayed=localizedSnippet(item,activeRole,getLanguage()),info=templateInfo(displayed),value=info?.scenario??'';
    if(scenario.value!==value)scenario.value=value;
    scenarioEdited=!!item&&displayed===item&&Object.hasOwn(item,'scenario');
    scenarioBox.querySelector('small').textContent=scenarioHint(info,getLanguage());
    scenarioBox.querySelector('small').title=info?.url??'';
  }
  const name = document.querySelector('#name'), text = document.querySelector('#text'), search = document.querySelector('#search'), saveStatus = document.querySelector('#save-status');
  let statusKey = '已儲存', statusParams = {}, statusError = null;
  function setSaveError(error) { statusError=error; saveStatus.textContent=t('目前角色：{role} · {status}',{role:roleName(activeRole,getLanguage()),status:errorMessage(error)});renderSaveOverview(); }
  function setSaveStatus(key, params = {}) { statusError=null; statusKey = key; statusParams = params; saveStatus.textContent = t('目前角色：{role} · {status}',{role:roleName(activeRole,getLanguage()),status:t(key, params)});renderSaveOverview(); }
  const workspace = document.querySelector('.workspace');
  const settingsButton = el('button', 'settings-link', '設定與 AI 教學');
  settingsButton.type = 'button'; settingsButton.setAttribute('aria-pressed', 'false');
  document.querySelector('.sidebar-foot').before(settingsButton);
  function showLibrary() { settings.panel.hidden = true; workspace.hidden = false; settingsButton.setAttribute('aria-pressed', 'false'); }
  const settings = createSettingsPage({ invoke, askConfirmation, onBack: showLibrary, onAddTemplate: item => { if (items.length >= 100) throw new Error('最多 100 句。'); stash(); items.push({name:item.name,text:item.text,scenario:item.scenario,custom:true}); selected=items.length-1; dirty=true; search.value=''; render(); setSaveStatus('尚未儲存'); },
    onReload: async () => {
      if (dirty && !await askConfirmation({title: '重新載入檔案？', message: '將以檔案內容取代目前編輯與未儲存草稿。請確認要保留的內容已儲存或另行備份。', confirmText: '重新載入'})) return false;
      const refreshed = await invoke('reload_snippets'); loadedSnapshot=await snapshotFor(refreshed);items = refreshed; versions=savedVersions(items);saveIssues=[];selected = 0; dirty = false; render(); setSaveStatus('已從檔案載入'); return true;
    },
    onImport: async imported => { const custom=imported.map(item=>({...item,scenario:item.scenario??'',custom:true}));await invoke('save_snippets', {items: custom,expected:loadedSnapshot,expectedRole:activeRole});loadedSnapshot=savedSnapshot(custom,true); items = custom; versions=savedVersions(items);saveIssues=[];selected = 0; dirty = false; search.value = ''; render(); setSaveStatus('已儲存'); },
  });
  document.querySelector('.manager').append(settings.panel);
  settingsButton.onclick = async () => { stash(); workspace.hidden = true; settings.panel.hidden = false; settingsButton.setAttribute('aria-pressed', 'true'); await settings.refresh(); };
  function stash() {
    const item=items[selected];if(!item)return;
    const displayed=localizedSnippet(item,activeRole,getLanguage());
    if(name.value!==displayed.name||text.value!==displayed.text||scenarioEdited){
      item.name=name.value;item.text=text.value;
      item.custom=true;
      // Explicit scenario detaches a custom edit from automatic template localization.
      item.scenario=scenarioEdited?scenario.value:(templateInfo(displayed)?.scenario??'');
    }
  }
  let dragging = -1;
  const sortTools = el('div', 'sort-tools');
  sortTools.innerHTML = '<span>拖曳排序</span><button type="button" aria-label="上移短句" title="上移選取短句">↑</button><button type="button" aria-label="下移短句" title="下移選取短句">↓</button>';
  document.querySelector('#snippets').before(sortTools);
  const [moveUp, moveDown] = sortTools.querySelectorAll('button');
  function moveSnippet(from, to) {
    if (search.value.trim() || from === to || to < 0 || to >= items.length) return;
    stash();
    const result = reorderSnippets(items, from, to, selected);
    items = result.items; selected = result.selected; dragging = -1; dirty = true;refreshIssues();
    render(); setSaveStatus('順序已調整，儲存後生效');
  }
  moveUp.onclick = () => { moveSnippet(selected, selected - 1); document.querySelector('.snippet.selected')?.scrollIntoView({block:'nearest'}); };
  moveDown.onclick = () => { moveSnippet(selected, selected + 1); document.querySelector('.snippet.selected')?.scrollIntoView({block:'nearest'}); };
  function renderList() {
    const list = document.querySelector('#snippets'); list.replaceChildren(); const query = search.value.trim().toLocaleLowerCase();
    document.querySelector('#library-count').textContent = items.length;
    moveUp.disabled = !!query || selected === 0; moveDown.disabled = !!query || selected === items.length - 1;
    sortTools.querySelector('span').textContent = query ? '清除搜尋後可排序' : '拖曳排序';
    items.forEach((savedItem, i) => {
      const item=localizedSnippet(savedItem,activeRole,getLanguage());
      if (!matchesSnippetQuery(item, query, templateInfo(item)?.scenario??'')) return;
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
  function render() { renderList(); renderScenario();renderIssues();renderSaveOverview(); const displayed=localizedSnippet(items[selected],activeRole,getLanguage());name.value = displayed?.name ?? ''; text.value = displayed?.text ?? ''; document.querySelector('#count').textContent = t('{count} 字', {count:characterCount(text.value)}); }
  function changed() { stash();refreshIssues();renderIssues(); renderScenario(); dirty = true; setSaveStatus('尚未儲存'); document.querySelector('#count').textContent = t('{count} 字', {count:characterCount(text.value)}); renderList(); }
  scenario.oninput=()=>{scenarioEdited=true;changed();};
  name.oninput = text.oninput = changed; search.oninput = renderList;
  function addSnippet() { stash(); if (items.length >= 100) return askConfirmation({title:t('最多 100 句。'),message:'',notice:true,confirmText:t('知道了')}); search.value = ''; items.push({ name: t('新短句'), text: '',scenario:'',custom:true }); selected = items.length - 1; dirty = true; render(); showLibrary(); setSaveStatus('尚未儲存'); name.focus(); name.select(); }
  document.querySelector('#add').onclick = addSnippet;
  async function consumeNewSnippet() { await roleSync; if (items.length && await invoke('consume_new_snippet')) addSnippet(); }
  await listen('new-snippet', consumeNewSnippet);
  async function consumeOpenSettings(){await roleSync;if(await invoke('consume_open_settings'))showLibrary();}
  await listen('open-settings',consumeOpenSettings);
  document.querySelector('#delete').onclick = async () => { if (items.length === 1) { await askConfirmation({title: '請至少保留一句短句', message: '先新增另一句短句，再刪除這一句。', confirmText: '知道了', notice: true}); return; } stash(); const target = selected; if (!await askConfirmation({title: '刪除短句？', message: t('確定要刪除「{name}」嗎？刪除後需按「儲存短句」才會生效。', {name:items[target].name || t('未命名短句')}), confirmText: '刪除短句', danger: true})) return; items.splice(target, 1); selected = Math.min(target, items.length - 1); dirty = true;refreshIssues(); render(); setSaveStatus('尚未儲存'); };
  document.querySelector('#editor').onsubmit = async e => {
    e.preventDefault();if(saving)return;stash();saving=true;document.querySelector('#editor').inert=true;roleSwitcher.inert=true;document.querySelector('aside').inert=true;
    saveTask=(async()=>{
    try{const result=prepareSnippetSave(items,versions);await invoke('save_snippets',{items:result.saved,expected:loadedSnapshot,expectedRole:activeRole});loadedSnapshot=savedSnapshot(result.saved,true);items=result.editorItems;versions=result.versions;saveIssues=result.issues;dirty=result.draftCount>0;render();setSaveStatus(result.draftCount?'完整短句已儲存 · {count} 筆草稿待完成':'已儲存',{count:result.draftCount});}
    catch(error){if(error.issues){saveIssues=error.issues;renderIssues();}setSaveError(error);}
    finally{saving=false;document.querySelector('#editor').inert=false;roleSwitcher.inert=false;document.querySelector('aside').inert=false;}
    })();await saveTask;
  };
  async function nativeStatus() { const status = await invoke('native_status'); const preview = status.startsWith('外觀預覽'); const ready = status.startsWith('已啟用') || preview; if (preview) document.querySelector('.workspace>footer').firstChild.textContent = t('外觀預覽 · 修改不會影響原有短句。'); document.querySelector('#native-status').classList.toggle('unavailable', !ready); document.querySelector('#native-status span').textContent = t(preview ? '外觀預覽' : ready ? '快捷鍵已啟用' : '快捷鍵需設定'); document.querySelector('#native-status').title = shortcutLabel(); document.querySelector('#native-error').hidden = ready; document.querySelector('#native-error').textContent = ready ? '' : errorMessage(status); document.querySelector('#retry').hidden = ready; }
  onShortcutChange(nativeStatus);
  // Bonus-03: inline guidance follows the actual shortcut without changing its behavior.
  const usageBar=document.querySelector('.usage-bar'),usageContent=el('div','usage-help');
  const usageInstruction=el('span',''),usageDetails=el('details',''),usageSummary=el('summary',''),usageExplanation=el('p','');
  usageDetails.append(usageSummary,usageExplanation);usageContent.append(usageInstruction,usageDetails);
  usageBar.lastElementChild.replaceWith(usageContent);
  function renderUsageHelp(){const help=usageHelp(getLanguage(),modifierLabel(),keyLabel());usageInstruction.textContent=help.instruction;usageSummary.textContent=help.summary;usageExplanation.textContent=help.details;}
  renderUsageHelp();onShortcutChange(renderUsageHelp);

  document.querySelector('#retry').onclick = async () => { await invoke('restart_keyboard'); await nativeStatus(); };
  async function hide() { if (!dirty || await askConfirmation({title: '收起視窗？', message: '目前有尚未儲存的修改。收起後程式仍會執行，草稿會保留在此視窗中。', confirmText: '收起視窗'})) await invoke('hide_manager'); }
  await listen('native-status', nativeStatus); await listen('save-before-hide', hide);
  let quitPromptOpen=false;
  await listen('quit-requested',async()=>{
    if(quitPromptOpen)return;quitPromptOpen=true;
    try{await roleSync;await saveTask;stash();const pending=unsavedRoleIds();
      if(pending.length){const names=pending.map(id=>roleName(id,getLanguage())).join('、');
        if(!await askConfirmation({title:'仍有未儲存內容，確定退出？',message:t('未儲存角色：{roles}。退出會放棄這些修改與草稿；取消後可回到各角色儲存。',{roles:names}),confirmText:'放棄未儲存內容並退出',danger:true}))return;
      }
      await invoke('confirm_quit');
    }catch(error){setSaveError(error);}finally{quitPromptOpen=false;}
  });
  const bar = document.querySelector('.windowbar');
  bar.onpointerdown = e => { if (e.button === 0 && !e.target.closest('button')) invoke('window_action', { action: 'drag' }); };
  document.querySelectorAll('[data-action]').forEach(button => { button.onclick = () => button.dataset.action === 'close' ? hide() : invoke('window_action', { action: button.dataset.action }); });
  const transparency = document.querySelector('#transparency'), theme = document.querySelector('#theme');
  transparency.value = appearance.transparency; theme.value = appearance.theme;
  document.querySelector('#transparency-value').value = `${appearance.transparency}%`;
  let effectTimer;
  transparency.oninput = () => { appearance.transparency = Number(transparency.value); document.querySelector('#transparency-value').value = `${appearance.transparency}%`; clearTimeout(effectTimer); effectTimer = setTimeout(() => applyAppearance(true), 70); };
  theme.onchange = () => { appearance.theme = theme.value; applyAppearance(true); };
  // WebView key handling can consume a registered hotkey before the global path.
  // The focused manager always treats its shortcut as dismiss-only.
  document.addEventListener('keydown', e => {
    if(!matchesShortcutEvent(e,getShortcut()))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!e.repeat)invoke('dismiss_manager_shortcut').catch(setSaveError);
  },true);
  document.addEventListener('keydown', e => { if (document.querySelector('dialog[open]')) return; if (!settings.panel.hidden) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') e.preventDefault(); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); document.querySelector('#editor').requestSubmit(); } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); search.focus(); } });
  await listen('active-role-changed',event=>{roleSync=roleSync.then(async()=>{await switchRole(event.payload);if(!settings.panel.hidden)await settings.refresh();}).catch(setSaveError);});
  onLanguageChange(() => { renderRoles(); render(); if(statusError) setSaveError(statusError); else setSaveStatus(statusKey,statusParams); nativeStatus(); });
  items = await invoke('get_snippets');loadedSnapshot=await snapshotFor(items); versions=savedVersions(items);renderRoles(); render(); setSaveStatus('已儲存'); await nativeStatus(); await consumeNewSnippet(); await consumeOpenSettings();
}












bindTranslations(document.body);
const syncNativeLanguage = () => invoke('set_ui_language', {language:getLanguage()}).catch(console.warn);
onLanguageChange(syncNativeLanguage);
await syncNativeLanguage();
document.documentElement.lang = getLanguage();

renderShortcut();
}

// Startup IPC failures must not leave a writable, partially initialized editor.
await startApp().catch(error => {
  document.querySelector('#app').inert = true;
  const panel = document.createElement('section');
  panel.className = 'startup-error';
  panel.setAttribute('role', 'alert');
  const title = document.createElement('h2');
  title.textContent = t('無法載入短句');
  const message = document.createElement('p');
  message.textContent = errorMessage(error);
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = t('重新載入');
  retry.onclick = () => location.reload();
  panel.append(title, message, retry); document.body.append(panel); retry.focus();
});
