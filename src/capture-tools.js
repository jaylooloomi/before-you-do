import {t,onLanguageChange,errorMessage} from './i18n.js';
export function createCaptureTools({invoke,listen,run}){
 const element=document.createElement('div');element.className='capture-tools-section';
 const actions=document.createElement('div');actions.className='recording-actions';
 const button=(key,fn)=>{const b=document.createElement('button');b.type='button';b.onclick=()=>run(fn);b.dataset.label=key;actions.append(b);return b;};
 const video=button('錄製影片',()=>invoke('capture_start',{mode:'record-video'}));
 const gif=button('錄製 GIF',()=>invoke('capture_start',{mode:'record-gif'}));
 const stop=button('停止錄影',async()=>{await invoke('recording_stop');await refresh();});
 const install=button('安裝錄影元件',async()=>{await invoke('recording_install');await refresh();});
 const status=document.createElement('p');status.className='recording-status';status.setAttribute('role','status');status.setAttribute('aria-label',t('錄影狀態'));
 const details=document.createElement('details');details.className='capture-tools';const summary=document.createElement('summary');details.append(summary);
 const preferences=['自動偵測','像素放大鏡'].map((key,index)=>{const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='checkbox';const storageKey='before-you-do.capture.'+(index?'magnifier':'auto');input.checked=localStorage.getItem(storageKey)!=='false';input.onchange=()=>localStorage.setItem(storageKey,String(input.checked));label.append(input,text);details.append(label);return {text,key};});
 const help=document.createElement('p');details.append(help);
 const fields=['region','fullscreen','window','video','gif'].map((key,index)=>{const label=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input');input.type='text';input.maxLength=80;input.autocomplete='off';label.append(text,input);details.append(label);return {key,text,input,label:['區域截圖','全螢幕截圖','目前視窗截圖','錄製影片','錄製 GIF'][index]};});
 const save=document.createElement('button');save.type='button';save.className='secondary';details.append(save);
 const shortcutStatus=document.createElement('p');shortcutStatus.setAttribute('role','status');details.append(shortcutStatus);
 let state=null,hotkeys=null,loaded=false,dirty=false;
 fields.forEach(({input})=>input.oninput=()=>{dirty=true;});
 save.onclick=()=>run(async()=>{try{hotkeys=await invoke('capture_hotkeys_save',{config:Object.fromEntries(fields.map(({key,input})=>[key,input.value.trim()]))});dirty=false;shortcutStatus.textContent=t('截圖快捷鍵已儲存');}catch(e){shortcutStatus.textContent=errorMessage(e);}});
 function render(){
  for(const b of actions.children)b.textContent=t(b.dataset.label);
  summary.textContent=t('截圖快捷鍵與選項');help.textContent=t('單擊擷取、拖曳框選、Tab 切換父層、Esc 或右鍵取消。快捷鍵可填 Ctrl/Alt/Shift + PrintScreen 或 F6–F12；留空停用。');
  for(const p of preferences)p.text.textContent=t(p.key);for(const field of fields)field.text.textContent=t(field.label);save.textContent=t('儲存截圖快捷鍵');
  if(!state){video.disabled=gif.disabled=install.disabled=stop.disabled=true;return;}
  const active=['recording','finalizing'].includes(state.status?.phase);video.disabled=gif.disabled=!state.supported||!state.runtime_ready||active;stop.disabled=!active||state.status?.phase==='finalizing';install.hidden=!state.supported||state.runtime_ready;install.disabled=state.installing||active;
  const phase=state.status?.phase||'idle';status.dataset.phase=phase;
  status.textContent=!state.supported?t('錄影目前支援 Windows；Mac 仍可使用截圖。'):!state.runtime_ready?t('錄影需要一次安裝約 82 MB 的 FFmpeg 元件。僅在按下安裝後下載，影片不含聲音。'):phase==='recording'?t('錄影中；再次按相同錄影快捷鍵或系統匣「Stop recording」停止。'):phase==='finalizing'?t('正在完成錄影，請稍候…'):phase==='error'?[t('錄影失敗'),state.status.error,state.status.recovery].filter(Boolean).join('\n'):phase==='saved'?t('錄影已加入素材區'):t('無聲影片 WebM / GIF；最長 120 秒，25 MB。');
  save.disabled=!hotkeys?.supported;for(const f of fields)f.input.disabled=!hotkeys?.supported;
  if(hotkeys?.error){shortcutStatus.textContent=hotkeys.error;details.open=true;}
 }
 async function refresh(){try{[state,hotkeys]=await Promise.all([invoke('recording_state'),invoke('capture_hotkeys_get')]);if(!dirty){for(const f of fields)f.input.value=hotkeys.config[f.key];}loaded=true;render();}catch(e){status.textContent=errorMessage(e);}}
 listen('recording-state',event=>{if(state){state.status=event.payload;render();}}).catch(e=>{status.textContent=errorMessage(e);});
 listen('capture-hotkeys-changed',event=>{hotkeys=event.payload;if(!dirty)for(const f of fields)f.input.value=hotkeys.config[f.key];render();}).catch(e=>{status.textContent=errorMessage(e);});
 element.append(actions,status,details);onLanguageChange(render);render();return {element,refresh,render,get loaded(){return loaded;}};
}
