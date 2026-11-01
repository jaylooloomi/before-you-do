import {actionIcon} from './workspace-ui.js';
import {attachShortcutRecorder,captureShortcutIssues} from './capture-shortcut-recorder.js';
import {t,onLanguageChange,errorMessage} from './i18n.js';
import {getShortcut,onShortcutChange} from './shortcut.js';
import {askConfirmation} from './dialog.js';
export function createCaptureTools({invoke,listen,run,onHotkeys=()=>{},captureActions={},onExecute=async()=>{}}){
 const element=document.createElement('div');element.className='capture-tools-section';
 const actions=document.createElement('div');actions.className='recording-actions';
 const button=(key,fn)=>{const b=document.createElement('button');b.type='button';b.onclick=()=>run(fn);b.dataset.label=key;actions.append(b);return b;};
 const video=button('錄製影片',()=>invoke('capture_start',{mode:'record-video'}));
 const gif=button('錄製 GIF',()=>invoke('capture_start',{mode:'record-gif'}));
 const stop=button('停止錄影',async()=>{await invoke('recording_stop');await refresh();});
 const install=button('安裝錄影元件',async()=>{await invoke('recording_install');await refresh();});
 const status=document.createElement('p');status.className='recording-status';status.setAttribute('role','status');status.setAttribute('aria-label',t('錄影狀態'));
 const details=document.createElement('details');details.className='capture-tools';const summary=document.createElement('summary');details.append(summary);
 const preferencesBox=document.createElement('div');preferencesBox.className='capture-inline-preferences';preferencesBox.setAttribute('role','group');
 const preferences=['自動偵測','像素放大鏡'].map((key,index)=>{const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='checkbox';const storageKey='before-you-do.capture.'+(index?'magnifier':'auto');input.checked=localStorage.getItem(storageKey)!=='false';input.onchange=()=>localStorage.setItem(storageKey,String(input.checked));label.append(input,text);preferencesBox.append(label);return {text,key};});
 const help=document.createElement('p');details.append(help);
 const fieldRows=document.createElement('div');fieldRows.className='capture-shortcut-rows';details.append(fieldRows);
 const fields=['region','fullscreen','window','video','gif','text','file','paste','quick'].map((key,index)=>{
  const row=document.createElement('div');row.className='capture-shortcut-row';row.setAttribute('role','group');
  const execute=document.createElement('button');execute.type='button';execute.className='secondary paired-capture-action';
  const input=document.createElement('input');input.type='text';input.maxLength=80;input.autocomplete='off';
  attachShortcutRecorder(input,{onUnsupported:()=>{feedback.textContent=t('請按 Ctrl 或 Alt 搭配字母／數字，或使用 PrintScreen、F6–F12。');}});
  const restore=document.createElement('button');restore.type='button';restore.className='shortcut-restore';
  const feedback=document.createElement('small');feedback.className='shortcut-field-feedback';feedback.id='capture-shortcut-feedback-'+key;input.setAttribute('aria-describedby',feedback.id);
  restore.onclick=()=>{input.value=hotkeys?.config[key]??'';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();};
  for(const [event,editing]of [['focus',true],['blur',false]])input.addEventListener(event,()=>{invoke('capture_hotkeys_editing',{editing}).catch(e=>{shortcutStatus.textContent=errorMessage(e);});});
  const target=index<3?captureActions[key]:index===3?video:index===4?gif:captureActions[key];
  execute.onclick=async()=>{try{await onExecute();const action=index>=5?captureActions[key]:target;if(action&&!action.disabled)action.click();}catch(e){shortcutStatus.textContent=errorMessage(e);}};
  row.append(execute,input,restore,feedback);fieldRows.append(row);return {key,input,execute,target,row,restore,feedback,label:['區域截圖','全螢幕截圖','目前視窗截圖','錄製影片','錄製 GIF','新增文字','新增檔案','貼上全部素材','本次素材速覽'][index]};
 });
 const save=document.createElement('button');save.type='button';save.className='secondary capture-shortcut-save';details.append(save);
 const shortcutStatus=document.createElement('p');shortcutStatus.setAttribute('role','status');details.append(shortcutStatus);
 let state=null,hotkeys=null,loaded=false,dirty=false,shortcutSaving=false,backendError=null,lastStatus='';
 function values(){return Object.fromEntries(fields.map(({key,input})=>[key,input.value.trim()]));}
 function bindingError(error){const text=error?.message??String(error);if(text.includes('Capture shortcuts must be different'))return t('快捷鍵不可重複，請為每個功能選擇不同組合。');if(text.startsWith('Shortcut conflict:'))return t('快捷鍵已被占用：{shortcut}。請改用其他組合。',{shortcut:text.slice(18).split('.')[0].trim()});return errorMessage(error);}
 function validate(){
  const main=getShortcut(),mainBinding=({alt:'Alt',altShift:'Alt+Shift',ctrl:'Ctrl',ctrlShift:'Ctrl+Shift'}[main.modifier]??'Alt')+'+'+main.key;
  const issues=captureShortcutIssues(values(),mainBinding);const labels=Object.fromEntries(fields.map(f=>[f.key,t(f.label)]));labels.snippet=t('常用短句');
  for(const f of fields){const issue=issues[f.key];f.input.setAttribute('aria-invalid',String(!!issue));f.feedback.textContent=issue?.type==='duplicate'?t('與「{action}」重複：{shortcut}',{action:issue.others.map(key=>labels[key]).join(' / '),shortcut:issue.binding}):issue?t('請按 Ctrl 或 Alt 搭配字母／數字，或使用 PrintScreen、F6–F12。'):'';f.input.placeholder=t('未設定（停用），點此按組合鍵');f.restore.textContent=t('還原');f.restore.setAttribute('aria-label',t('還原')+' '+t(f.label));f.restore.disabled=shortcutSaving||!hotkeys?.supported||f.input.value===(hotkeys?.config[f.key]??'');}
  const count=Object.keys(issues).length;save.disabled=!hotkeys?.supported||shortcutSaving||count>0;
  shortcutStatus.textContent=count?t('有 {count} 個快捷鍵需要修正。',{count}):backendError?bindingError(backendError):lastStatus?t(lastStatus):dirty?t('尚未儲存'):'';
  return count===0;
 }
 fields.forEach(({input})=>input.oninput=()=>{dirty=true;backendError=null;lastStatus='';validate();});
 save.onclick=async()=>{
  if(shortcutSaving||!validate()||!hotkeys?.supported)return;
  const config=values(),disabled=fields.filter(f=>!config[f.key]&&hotkeys.config[f.key]);
  if(disabled.length&&!await askConfirmation({title:'停用這些快捷鍵？',message:disabled.map(f=>t(f.label)).join('、')+'\n'+t('功能仍可從素材區使用；只有快捷鍵會停用。'),confirmText:'儲存並停用'}))return;
  shortcutSaving=true;validate();
  await run(async()=>{try{hotkeys=await invoke('capture_hotkeys_save',{config});dirty=false;backendError=null;lastStatus='截圖快捷鍵已儲存';onHotkeys(hotkeys);}catch(e){backendError=e;}finally{shortcutSaving=false;validate();}}).finally(()=>{shortcutSaving=false;validate();});
 };
 listen('capture-shortcut-recorded',event=>{const field=fields.find(f=>f.input===document.activeElement);if(field&&!field.input.disabled){field.input.value=event.payload;field.input.dispatchEvent(new Event('input',{bubbles:true}));}}).catch(e=>{backendError=e;validate();});
 onShortcutChange(validate);
 function render(){
  for(const [index,b]of [...actions.children].entries())actionIcon(b,['video','gif','close','settings'][index],t(['錄影','GIF','停止錄影','安裝錄影元件'][index]),t(b.dataset.label));
  summary.textContent=t('截圖選項');summary.dataset.shortLabel=t('設定');summary.title=t('截圖選項');help.textContent=t('點選快捷鍵欄位後直接按組合鍵，例如 Alt+J。Backspace 清除、Esc 還原；按儲存後生效。');
  preferencesBox.setAttribute('aria-label',t('截圖選項'));for(const p of preferences)p.text.textContent=t(p.key);for(const [index,field]of fields.entries()){actionIcon(field.execute,['region','region','window','video','gif','text','file','copy','folder'][index],t(field.label),t('執行')+' '+t(field.label));const action=captureActions[field.key]??field.target;field.execute.disabled=!action||action.disabled;field.input.setAttribute('aria-label',t(field.label));field.row.setAttribute('aria-label',t(field.label)+' '+t('快捷鍵'));}save.textContent=t('儲存快捷鍵');
  if(!state){video.disabled=gif.disabled=install.disabled=stop.disabled=true;return;}
  const active=['recording','pausing','paused','finalizing'].includes(state.status?.phase);video.disabled=gif.disabled=!state.supported||!state.runtime_ready||active;stop.disabled=!active||state.status?.phase==='finalizing';install.hidden=!state.supported||state.runtime_ready;install.disabled=state.installing||active;
  for(const field of fields){const action=captureActions[field.key]??field.target;field.execute.disabled=!action||action.disabled;}
  const phase=state.status?.phase||'idle';status.dataset.phase=phase;status.hidden=phase==='idle'&&state.supported&&state.runtime_ready;stop.hidden=!active;
  status.textContent=!state.supported?t('錄影目前支援 Windows；Mac 仍可使用截圖。'):!state.runtime_ready?t('錄影需要一次安裝約 82 MB 的 FFmpeg 元件。僅在按下安裝後下載，影片不含聲音。'):phase==='recording'?t('錄影中；再次按相同錄影快捷鍵或系統匣「Stop recording」停止。'):phase==='paused'?t('錄影已暫停'):phase==='pausing'?t('正在暫停錄影…'):phase==='cancelled'?t('已取消錄影，未加入素材'):phase==='finalizing'?t('正在完成錄影，請稍候…'):phase==='error'?[t('錄影失敗'),state.status.error,state.status.recovery].filter(Boolean).join('\n'):phase==='saved'?t('錄影已加入素材區'):t('無聲影片 WebM / GIF；最長 120 秒，25 MB。');
  for(const f of fields)f.input.disabled=!hotkeys?.supported||shortcutSaving;
  if(hotkeys?.error)backendError=hotkeys.error;validate();
 }
 async function refresh(){try{[state,hotkeys]=await Promise.all([invoke('recording_state'),invoke('capture_hotkeys_get')]);hotkeys.config={text:'',file:'',paste:'',quick:'Alt+K',...hotkeys.config};if(!dirty){for(const f of fields)f.input.value=hotkeys.config[f.key]??({text:'',file:'',paste:'',quick:'Alt+K'}[f.key]??'');}loaded=true;onHotkeys(hotkeys);render();}catch(e){status.textContent=errorMessage(e);}}
 listen('recording-state',event=>{if(state){state.status=event.payload;render();}}).catch(e=>{status.textContent=errorMessage(e);});
 listen('capture-hotkeys-changed',event=>{hotkeys=event.payload;hotkeys.config={text:'',file:'',paste:'',quick:'Alt+K',...hotkeys.config};onHotkeys(hotkeys);backendError=hotkeys.error;lastStatus='截圖快捷鍵已儲存';if(!dirty)for(const f of fields)f.input.value=hotkeys.config[f.key]??({text:'',file:''}[f.key]??'');render();}).catch(e=>{status.textContent=errorMessage(e);});
 const shortcutSettings=document.createElement('div');shortcutSettings.className='central-capture-shortcuts';shortcutSettings.append(help,fieldRows,save,shortcutStatus);
 const content=document.createElement('div');content.className='capture-tools-content';content.append(...[...details.children].filter(node=>node!==summary));details.append(content);
 element.append(actions,status);onLanguageChange(render);render();return {element,details,content,shortcutSettings,preferencesBox,refresh,render,get loaded(){return loaded;}};
}
