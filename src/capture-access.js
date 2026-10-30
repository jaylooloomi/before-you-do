import {actionIcon} from './workspace-ui.js';
import {t,onLanguageChange,errorMessage} from './i18n.js';
export function canCapture(capability){return !!capability?.supported&&['granted','not_required'].includes(capability.permission);}
export function createCaptureAccess({invoke,run,onCapture,isBusy=()=>false}){
 const element=document.createElement('div');element.className='capture-access';
 element.innerHTML='<div class="capture-mode-buttons" role="group"></div><p class="capture-access-status" role="status"></p><div class="capture-permission-buttons"></div>';
 const modes=element.querySelector('[role=group]'),status=element.querySelector('[role=status]'),actions=element.querySelector('.capture-permission-buttons');
 let capability=null,failure=null,permissionPending=false;
 const labels=[['region','區域截圖'],['fullscreen','全螢幕截圖'],['window','目前視窗截圖']];
 const buttons=labels.map(([mode,label])=>{const button=document.createElement('button');button.type='button';button.className='secondary';button.onclick=()=>run(async()=>{await refresh();if(canCapture(capability)){try{await onCapture(mode);}catch(error){await refresh();throw error;}}});modes.append(button);return button;});
 function action(key,fn){const button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.label=key;button.onclick=()=>run(fn);actions.append(button);return button;}
 const request=action('授權螢幕擷取',async()=>{permissionPending=true;render();try{capability=await invoke('capture_request_permission');failure=null;}catch(error){failure=error;}finally{permissionPending=false;render();}});
 const settings=action('開啟螢幕擷取設定',async()=>{try{await invoke('capture_open_permissions');}catch(error){failure=error;}render();});
 action('重新檢查截圖權限',refresh);
 async function refresh(){try{capability=await invoke('capture_capabilities');failure=null;}catch(error){capability=null;failure=error;}render();return capability;}
 function render(){
  modes.setAttribute('aria-label',t('截圖操作'));status.setAttribute('aria-label',t('截圖狀態'));
  buttons.forEach((button,i)=>{actionIcon(button,['region','region','window'][i],t(['區域截圖','全螢幕','視窗'][i]),t(labels[i][1]));button.disabled=isBusy()||!canCapture(capability);});
  for(const button of actions.children){button.textContent=t(button.dataset.label);button.disabled=isBusy();}
  status.hidden=canCapture(capability)&&!failure&&!permissionPending;actions.hidden=canCapture(capability)&&!failure;
  const needsPermission=capability?.supported&&capability.permission==='required';request.hidden=!needsPermission;settings.hidden=!(needsPermission&&capability?.platform==='macos');
  if(permissionPending)status.textContent=t('正在等待螢幕擷取授權…');
  else if(failure)status.textContent=t('無法確認截圖能力')+'：'+errorMessage(failure);
  else if(!capability)status.textContent=t('正在確認截圖能力…');
  else if(!canCapture(capability))status.textContent=errorMessage(capability.reason||'error.capture_permission');
  else status.textContent=t(capability.windowSemantics==='independent_window'?'目前視窗會擷取切回本程式前的其他 App 視窗內容。':'目前視窗擷取可見的桌面像素，被遮住的內容可能無法取得。');
 }
 onLanguageChange(render);render();return {element,refresh,render};
}
