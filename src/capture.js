import {t,onLanguageChange} from './i18n.js';
export function selectionRect(start,end,width,height,viewWidth,viewHeight){
  if(!start||!end||viewWidth<=0||viewHeight<=0)return null;
  const left=Math.max(0,Math.min(width,Math.floor(Math.min(start.x,end.x)*width/viewWidth)));
  const top=Math.max(0,Math.min(height,Math.floor(Math.min(start.y,end.y)*height/viewHeight)));
  const right=Math.max(left,Math.min(width,Math.ceil(Math.max(start.x,end.x)*width/viewWidth)));
  const bottom=Math.max(top,Math.min(height,Math.ceil(Math.max(start.y,end.y)*height/viewHeight)));
  return right>left&&bottom>top?[left,top,right-left,bottom-top]:null;
}
export async function mountCapture(root,{invoke,listen}){
  document.body.className='capture-surface';
  root.innerHTML='<img class="capture-background" alt="Frozen desktop"><div class="capture-shade"></div><div class="capture-selection" hidden></div><div class="capture-hud"><span></span><button type="button"></button></div><p role="alert" class="capture-error"></p>';
  const image=root.querySelector('img'),selection=root.querySelector('.capture-selection'),hint=root.querySelector('.capture-hud span'),cancel=root.querySelector('button'),error=root.querySelector('[role=alert]');
  let frame,start,end,finishing=false;
  const labels=()=>{hint.textContent=t('拖曳選取截圖區域，Esc 取消');cancel.textContent=t('取消截圖');};labels();onLanguageChange(labels);
  async function load(){try{frame=await invoke('capture_frame');image.src=frame.image;selection.hidden=true;start=end=null;error.textContent='';finishing=false;}catch(e){error.textContent=String(e);}}
  async function finish(rect){if(finishing)return;finishing=true;try{await invoke('capture_finish',{rect});}catch(e){error.textContent=String(e);finishing=false;}}
  cancel.onclick=()=>finish(null);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish(null);}});
  root.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button')||!frame||finishing)return;root.setPointerCapture(event.pointerId);start=end={x:event.clientX,y:event.clientY};selection.hidden=false;paint();});
  function paint(){const x=Math.min(start.x,end.x),y=Math.min(start.y,end.y);Object.assign(selection.style,{left:x+'px',top:y+'px',width:Math.abs(end.x-start.x)+'px',height:Math.abs(end.y-start.y)+'px'});}
  root.addEventListener('pointermove',event=>{if(!start||finishing)return;end={x:event.clientX,y:event.clientY};paint();});
  root.addEventListener('pointerup',event=>{if(!start||finishing||event.button!==0)return;end={x:event.clientX,y:event.clientY};const rect=selectionRect(start,end,frame.width,frame.height,innerWidth,innerHeight);if(rect)finish(rect);else{start=null;selection.hidden=true;}});
  root.addEventListener('pointercancel',()=>{start=null;selection.hidden=true;});
  await listen('capture-ready',load);
  try{const initial=await invoke('capture_frame');frame=initial;image.src=initial.image;}catch{/* No pending capture during hidden-window preload. */}
  // The overlay is preloaded before any capture session exists.
}
