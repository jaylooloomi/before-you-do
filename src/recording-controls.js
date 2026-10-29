import {t,onLanguageChange,errorMessage} from './i18n.js';
export function recordingTime(ms){const total=Math.floor(Math.max(0,ms)/1000);return [Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(v=>String(v).padStart(2,'0')).join(':');}
export async function mountRecordingControls(root,{invoke,listen}){
 document.body.className='recording-controls-surface';root.innerHTML='<div class="recording-control-bar" role="toolbar"><button type="button" data-action="stop"></button><button type="button" data-action="pause"></button><button type="button" data-action="cancel"></button><output role="timer" aria-live="off">00:00:00</output></div><p role="alert"></p>';
 const toolbar=root.querySelector('[role=toolbar]'),stop=root.querySelector('[data-action=stop]'),pause=root.querySelector('[data-action=pause]'),cancel=root.querySelector('[data-action=cancel]'),timer=root.querySelector('[role=timer]'),error=root.querySelector('[role=alert]');
 let state={phase:'idle',elapsed_ms:0},received=performance.now(),pending=false;
 function render(){const paused=state.phase==='paused';toolbar.setAttribute('aria-label',t('錄影控制'));toolbar.dataset.phase=state.phase;stop.textContent=t('停止');pause.textContent=t(paused?'繼續':'暫停');cancel.textContent=t('取消');timer.setAttribute('aria-label',t('錄影時間'));const blocked=pending||!['recording','paused'].includes(state.phase);stop.disabled=pause.disabled=cancel.disabled=blocked;timer.textContent=recordingTime(state.elapsed_ms+(state.phase==='recording'?performance.now()-received:0));}
 async function action(action){if(pending)return;pending=true;render();error.textContent='';try{await invoke('recording_control',{action});const view=await invoke('recording_state');accept(view.status);}catch(e){error.textContent=errorMessage(e);}finally{pending=false;render();}}
 function accept(next){state=next;received=performance.now();render();}
 stop.onclick=()=>action('stop');pause.onclick=()=>action(state.phase==='paused'?'resume':'pause');cancel.onclick=()=>action('cancel');
 window.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();action('cancel');}});
 await listen('recording-state',event=>accept(event.payload));onLanguageChange(render);setInterval(()=>{if(state.phase==='recording')timer.textContent=recordingTime(state.elapsed_ms+performance.now()-received);},100);
 try{accept((await invoke('recording_state')).status);}catch(e){error.textContent=errorMessage(e);}render();
}
