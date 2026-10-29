import {t,onLanguageChange,errorMessage} from './i18n.js';
import {RegionSelection,imagePoint,cssRect,floatingPosition,magnifierSample} from './region-selection.js';
export {selectionRect} from './region-selection.js';
export async function mountCapture(root,{invoke,listen}){
 document.body.className='capture-surface';
 root.innerHTML='<img class="capture-background" alt="Frozen desktop"><div class="capture-shade"><i></i><i></i><i></i><i></i></div><div class="capture-selection" role="region" hidden></div><output class="capture-bounds" aria-live="off" hidden></output><div class="capture-hud capture-ui" hidden><span></span><label><input type="checkbox" data-capture="auto" checked><b></b></label><label><input type="checkbox" data-capture="magnifier" checked><b></b></label><button type="button" data-capture="cycle"></button><button type="button" data-capture="cancel"></button></div><div class="capture-loupe" role="figure" hidden><canvas width="136" height="136"></canvas><output aria-live="off"></output></div><p role="alert" class="capture-error"></p>';
 const image=root.querySelector('img'),selection=root.querySelector('.capture-selection'),shade=[...root.querySelector('.capture-shade').children],bounds=root.querySelector('.capture-bounds');
 const hint=root.querySelector('.capture-hud>span'),auto=root.querySelector('[data-capture=auto]'),magnifier=root.querySelector('[data-capture=magnifier]'),cycle=root.querySelector('[data-capture=cycle]'),cancel=root.querySelector('[data-capture=cancel]'),error=root.querySelector('[role=alert]'),loupe=root.querySelector('.capture-loupe'),canvas=root.querySelector('canvas'),pixelInfo=loupe.querySelector('output');
 const context=canvas.getContext('2d',{willReadFrequently:true});
 let frame=null,model=null,pointer=null,finishing=false,loading=0,scheduled=false,pointerId=null,movement=0;
 try{auto.checked=localStorage.getItem('before-you-do.capture.auto')!=='false';magnifier.checked=localStorage.getItem('before-you-do.capture.magnifier')!=='false';}catch{}
 const labels=()=>{hint.textContent=t('移動預覽，單擊擷取；拖曳自選範圍，Esc 取消。');auto.nextElementSibling.textContent=t('自動偵測');magnifier.nextElementSibling.textContent=t('像素放大鏡');cycle.textContent=t('切換範圍 (Tab)');cancel.textContent=t('取消截圖');selection.setAttribute('aria-label',t('截圖選取範圍'));bounds.setAttribute('aria-label',t('截圖座標與尺寸'));loupe.setAttribute('aria-label',t('像素放大鏡'));canvas.setAttribute('aria-label',t('游標像素放大預覽'));pixelInfo.setAttribute('aria-label',t('游標座標與色彩'));};labels();onLanguageChange(()=>{labels();schedule();});
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;paint();});}
 async function accept(next,ticket,{keepError=false,pointerVersion=movement}={}){
  image.src=next.image;await image.decode();if(ticket!==loading)return;
  try{auto.checked=localStorage.getItem('before-you-do.capture.auto')!=='false';magnifier.checked=localStorage.getItem('before-you-do.capture.magnifier')!=='false';}catch{}
  frame=next;model=new RegionSelection(frame);model.enabled=auto.checked;
  const seed=()=>{if(movement===pointerVersion||!pointer){const p=frame.pointer??[frame.width/2,frame.height/2];pointer={x:p[0]/frame.width*innerWidth,y:p[1]/frame.height*innerHeight};}model.move(pointer,innerWidth,innerHeight);};
  seed();if(!keepError)error.textContent='';finishing=false;root.dataset.captureReady='painted';paint();
  await invoke('capture_prime',{session:frame.session});if(ticket!==loading)return;
  // Hidden WebViews may throttle RAF. Prime at alpha zero, then submit two real compositor frames.
  await new Promise(resolve=>requestAnimationFrame(()=>{if(ticket===loading){seed();paint();}requestAnimationFrame(resolve);}));
  if(ticket!==loading)return;await invoke('capture_present',{session:frame.session});if(ticket===loading)root.dataset.captureReady='presented';
 }
 async function load(options={}){
  const ticket=++loading,pointerVersion=movement;let session=options.session??null;frame=model=null;delete root.dataset.captureReady;selection.hidden=bounds.hidden=loupe.hidden=true;
  try{const next=await invoke('capture_frame');session=next.session;if(ticket!==loading)return;await accept(next,ticket,{...options,pointerVersion});}catch(e){if(ticket===loading){error.textContent=errorMessage(e);finishing=false;if(session!==null)await invoke('capture_prepare_failed',{session}).catch(()=>{});}}
 }
 async function finish(rect){
  if(finishing)return;finishing=true;const ticket=loading,session=rect?frame?.session??null:null;
  try{await invoke('capture_finish',{rect,session});if(ticket===loading){++loading;frame=model=null;selection.hidden=bounds.hidden=loupe.hidden=true;}}
  catch(e){if(ticket!==loading)return;error.textContent=errorMessage(e);finishing=false;if((e?.message??String(e)).startsWith('error.capture_session'))await load({keepError:true});}
 }
 function setRect(node,rect){Object.assign(node.style,{left:rect[0]+'px',top:rect[1]+'px',width:rect[2]+'px',height:rect[3]+'px'});}
 function paint(){
  const viewWidth=innerWidth,viewHeight=innerHeight;
  const rect=model?.rect(viewWidth,viewHeight),css=cssRect(rect,frame?.width??1,frame?.height??1,viewWidth,viewHeight);
  cycle.disabled=(model?.chain.length??0)<2||!!model.pressState;
  selection.hidden=bounds.hidden=!css;
  if(css){
   setRect(selection,css);selection.dataset.mode=model.pressState?.dragged?'manual':'automatic';
   const[x,y,w,h]=css;[[0,0,viewWidth,y],[0,y,x,h],[x+w,y,Math.max(0,viewWidth-x-w),h],[0,y+h,viewWidth,Math.max(0,viewHeight-y-h)]].forEach((r,i)=>setRect(shade[i],r));
   const origin=frame.origin??[0,0];bounds.textContent=`X: ${origin[0]+rect[0]}  Y: ${origin[1]+rect[1]}  W: ${rect[2]}  H: ${rect[3]}`;
   bounds.style.left=Math.max(4,Math.min(viewWidth-bounds.offsetWidth-4,x))+'px';bounds.style.top=Math.max(4,y>=30?y-28:Math.min(viewHeight-30,y+5))+'px';
  }else{setRect(shade[0],[0,0,viewWidth,viewHeight]);for(let i=1;i<4;i++)setRect(shade[i],[0,0,0,0]);}
  if(!frame||!pointer||!magnifier.checked||!context||!image.complete){loupe.hidden=true;return;}
  loupe.hidden=false;
  const point=imagePoint(pointer,frame.width,frame.height,viewWidth,viewHeight),sample=magnifierSample(point,frame.width,frame.height),scale=canvas.width/sample.count;
  context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle='#252830';context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=false;
  // Only frozen image pixels are sampled. Out-of-image samples remain dark instead of shifting the cursor center.
  context.drawImage(image,sample.sx,sample.sy,sample.sw,sample.sh,sample.dx*scale,sample.dy*scale,sample.sw*scale,sample.sh*scale);
  const center=canvas.width/2,color=context.getImageData(Math.floor(center),Math.floor(center),1,1).data;
  context.strokeStyle='#ffffff44';context.lineWidth=.5;for(let i=1;i<sample.count;i++){const p=Math.round(i*scale)+.5;context.beginPath();context.moveTo(p,0);context.lineTo(p,canvas.height);context.moveTo(0,p);context.lineTo(canvas.width,p);context.stroke();}
  context.strokeStyle='#000';context.lineWidth=3;context.strokeRect(Math.floor(sample.count/2)*scale,Math.floor(sample.count/2)*scale,scale,scale);context.strokeStyle='#fff';context.lineWidth=1;context.strokeRect(Math.floor(sample.count/2)*scale,Math.floor(sample.count/2)*scale,scale,scale);
  const origin=frame.origin??[0,0],hex=[...color].slice(0,3).map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();pixelInfo.textContent=`X: ${origin[0]+sample.center.x}  Y: ${origin[1]+sample.center.y}\n#${hex}`;
  const position=floatingPosition(pointer,loupe.offsetWidth,loupe.offsetHeight,viewWidth,viewHeight);loupe.style.left=position.x+'px';loupe.style.top=position.y+'px';
 }
 cancel.onclick=()=>finish(null);cycle.onclick=()=>{model?.cycle(1);schedule();};
 auto.onchange=()=>{try{localStorage.setItem('before-you-do.capture.auto',String(auto.checked));}catch{}model?.setEnabled(auto.checked,innerWidth,innerHeight);schedule();};
 magnifier.onchange=()=>{try{localStorage.setItem('before-you-do.capture.magnifier',String(magnifier.checked));}catch{}schedule();};
 window.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();finish(null);return;}
  if(event.key==='Tab'&&!event.target.closest?.('.capture-ui')&&model?.cycle(event.shiftKey?-1:1)){event.preventDefault();schedule();}
  if(event.key==='Enter'&&!event.target.closest?.('.capture-ui')&&model&&!model.pressState){const rect=model.rect(innerWidth,innerHeight);if(rect){event.preventDefault();finish(rect);}}
 });
 root.addEventListener('contextmenu',event=>{event.preventDefault();finish(null);});
 root.addEventListener('pointerdown',event=>{
  if(event.target.closest('.capture-ui'))return;if(event.button===2){event.preventDefault();return;}if(event.button!==0||!model||finishing)return;
  error.textContent='';pointer={x:event.clientX,y:event.clientY};pointerId=event.pointerId;root.setPointerCapture(pointerId);model.press(pointer,innerWidth,innerHeight);schedule();
 });
 root.addEventListener('pointermove',event=>{pointer={x:event.clientX,y:event.clientY};movement++;if(!model||finishing)return;model.move(pointer,innerWidth,innerHeight);schedule();});
 root.addEventListener('pointerup',event=>{
  if(event.button!==0||!model?.pressState||finishing||event.pointerId!==pointerId)return;
  pointer={x:event.clientX,y:event.clientY};const rect=model.release(pointer,innerWidth,innerHeight);
  if(root.hasPointerCapture(pointerId))root.releasePointerCapture(pointerId);pointerId=null;schedule();if(rect)finish(rect);
 });
 root.addEventListener('pointercancel',()=>{model?.reset();pointerId=null;schedule();});
 window.addEventListener('resize',()=>{if(model&&pointer&&!model.pressState)model.move(pointer,innerWidth,innerHeight);schedule();});
 await listen('capture-ready',event=>load({session:Number.isSafeInteger(event.payload)?event.payload:null}));
 // Recovery also covers capture-ready arriving before the preload listener was attached.
 await load();
 schedule();
}
