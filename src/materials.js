import {t,onLanguageChange,errorMessage} from './i18n.js';
import {createCaptureAccess} from './capture-access.js';
import {createCaptureTools} from './capture-tools.js';
export function materialPrompt(items){return items.map(item=>item.kind==='text'?item.text:`[Attachment: ${item.name}]`).filter(Boolean).join('\n\n');}
export function moveMaterial(items,id,delta){const index=items.findIndex(i=>i.id===id),next=index+delta;if(index<0||next<0||next>=items.length)return items.map(i=>i.id);const ids=items.map(i=>i.id);[ids[index],ids[next]]=[ids[next],ids[index]];return ids;}
export function createMaterialsPage({invoke,listen,onBack}){
 const panel=document.createElement('section');panel.className='materials-panel';panel.hidden=true;
 panel.innerHTML='<header><div><span class="eyebrow">PROMPT WORKSPACE</span><h2>本次 prompt 素材</h2></div><button type="button" class="secondary" data-material="back">返回短句</button></header><p class="materials-intro">收集這次任務的畫面、文字和檔案，整理後再交給 AI。</p><div class="material-toolbar"></div><div class="material-status" role="status" aria-live="polite"></div><div class="material-list" role="list"></div><div class="material-export"><button type="button" class="secondary" data-material="save">儲存文字草稿</button><button type="button" class="secondary" data-material="copy">複製整合文字</button><button type="button" class="primary" data-material="export">匯出素材包</button></div><p class="materials-help">素材自動儲存在本機，與短句分開。匯出後包含 prompt.md 和附件；不會自動貼上或送出。</p><p class="material-path"></p>';
 const center=document.createElement('div');center.className='materials-center';center.append(...panel.children);panel.append(center);
 const inspector=document.createElement('aside');inspector.className='material-inspector';inspector.innerHTML='<h2>'+t('素材預覽')+'</h2><div class="inspector-content"></div>';panel.append(inspector);
 for(const [heading,number]of [[center.querySelector('h2'),'1'],[inspector.querySelector('h2'),'2']]){const badge=document.createElement('span');badge.className='step-badge';badge.setAttribute('aria-hidden','true');badge.textContent=number;heading.prepend(badge);}
 inspector.append(center.querySelector('.material-export'),center.querySelector('.materials-help'),center.querySelector('.material-path'));
 function source(item){if(!previews.has(item.id))previews.set(item.id,invoke('materials_preview',{itemId:item.id}).catch(e=>{previews.delete(item.id);throw e;}));return previews.get(item.id);}
 function pauseOthers(current){for(const media of panel.querySelectorAll('video'))if(media!==current)media.pause();}
 function inspect(){const item=items.find(i=>i.id===selectedId)??items[0];selectedId=item?.id??null;const body=inspector.querySelector('.inspector-content');body.replaceChildren();for(const card of list.children)card.classList.toggle('is-selected',card.dataset.id===selectedId);if(!item)return;
 const title=document.createElement('h3');title.textContent=item.kind==='text'?t('任務文字'):item.name;body.append(title);
 const detail=document.createElement('p');detail.className='inspector-metadata';detail.textContent=item.kind==='text'?t('{count} 字',{count:Array.from(pending.get(item.id)??item.text??'').length}):`${(item.size/1024).toFixed(1)} KB`;body.append(detail);
 if(item.kind==='text'){const text=document.createElement('p');text.className='inspector-text';text.textContent=pending.get(item.id)??item.text;body.append(text);}
 else if(item.kind==='image'||/\.(webm|mp4)$/i.test(item.name)){const media=document.createElement(item.kind==='image'?'img':'video');if(item.kind==='image')media.alt=t('選取素材')+' '+item.name;else{media.controls=true;media.preload='metadata';media.playsInline=true;media.setAttribute('aria-label',t('選取素材')+' '+item.name);media.onplay=()=>pauseOthers(media);}
 const metadata=()=>{if(!media.isConnected)return;const width=media.naturalWidth||media.videoWidth,height=media.naturalHeight||media.videoHeight;detail.textContent=`${(item.size/1024).toFixed(1)} KB`+(width?` · ${width} × ${height}`:'')+(Number.isFinite(media.duration)?` · ${media.duration.toFixed(1)} s`:'');};media.addEventListener('load',metadata);media.addEventListener('loadedmetadata',metadata);body.prepend(media);source(item).then(src=>{if(media.isConnected)media.src=src;}).catch(e=>{if(media.isConnected)message(errorMessage(e));});}
 }
 new MutationObserver(()=>{if(panel.hidden)pauseOthers(null);}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 const toolbar=panel.querySelector('.material-toolbar'),list=panel.querySelector('[role=list]'),status=panel.querySelector('[role=status]'),output=panel.querySelector('.material-path');
 let selectedId=null;const previews=new Map();let initialized=false;let items=[],busy=false,queue=Promise.resolve(),timer,loadFailed=false;const draftKey='before-you-do.material-drafts';let savedDrafts=[];try{const saved=JSON.parse(localStorage.getItem(draftKey)||'[]');if(Array.isArray(saved))savedDrafts=saved.filter(pair=>Array.isArray(pair)&&typeof pair[0]==='string'&&typeof pair[1]==='string');}catch{}const pending=new Map(savedDrafts);
 function persistDrafts(){localStorage.setItem(draftKey,JSON.stringify([...pending]));}
 const control=(text,fn)=>{const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=t(text);button.onclick=()=>run(fn);toolbar.append(button);return button;};
 function message(text){status.textContent=text;}
 function lock(value){busy=value;for(const node of panel.querySelectorAll('button,textarea,input')){if(value){node.dataset.wasDisabled=String(node.disabled);node.disabled=true;}else if(node.dataset.wasDisabled!==undefined){node.disabled=node.dataset.wasDisabled==='true';delete node.dataset.wasDisabled;}}if(!value){access.render();tools.render();}}
 async function flushInternal(){clearTimeout(timer);if(!initialized&&pending.size){await reload();initialized=true;}for(const [id,text]of [...pending]){await invoke('materials_text',{itemId:id,text});if(pending.get(id)===text){pending.delete(id);persistDrafts();}}message(t('素材已儲存'));}
 function run(fn){if(busy)return Promise.resolve();lock(true);queue=queue.catch(()=>{}).then(async()=>{try{await flushInternal();await fn();}catch(e){message(t('素材操作失敗')+'：'+errorMessage(e));}finally{lock(false);}});return queue;}
 async function reload(){const result=await invoke('materials_load');items=result.items;initialized=true;loadFailed=false;render();}
 function updateText(id,text){pending.set(id,text);try{persistDrafts();}catch(e){message(t('素材操作失敗')+'：'+errorMessage(e));}const item=items.find(i=>i.id===id);if(item)item.text=text;if(selectedId===id)inspect();message(t('文字草稿尚未儲存'));clearTimeout(timer);timer=setTimeout(()=>{queue=queue.catch(()=>{}).then(flushInternal).catch(e=>message(t('素材操作失敗')+'：'+errorMessage(e)));},500);}
 async function capture(mode){await invoke('capture_start',{mode});}
 const access=createCaptureAccess({invoke,run,onCapture:capture,isBusy:()=>busy});toolbar.append(access.element);
 const tools=createCaptureTools({invoke,listen,run});toolbar.append(tools.element);
 control('加入文字',async()=>{items=(await invoke('materials_text',{itemId:null,text:''})).items;selectedId=items.at(-1)?.id;render();list.querySelector('article:last-child textarea')?.focus();});
 const file=document.createElement('input');file.type='file';file.multiple=true;file.hidden=true;file.setAttribute('aria-label',t('選擇素材檔案'));panel.append(file);
 const fileButton=control('加入檔案',()=>{});fileButton.onclick=()=>{if(!busy)file.click();};
 file.onchange=()=>{const files=[...file.files];file.value='';run(async()=>{for(const selected of files){if(selected.size>25*1024*1024)throw new Error(t('每個檔案上限 25 MB'));items=(await invoke('materials_import',{name:selected.name,bytes:Array.from(new Uint8Array(await selected.arrayBuffer()))})).items;render();}});};
 const back=panel.querySelector('[data-material=back]');back.onclick=()=>run(async()=>onBack());
 panel.querySelector('[data-material=save]').onclick=()=>run(async()=>{});
 panel.querySelector('[data-material=copy]').onclick=()=>run(async()=>{await invoke('copy_text',{text:materialPrompt(items)});message(t('已複製整合文字；圖片與檔案請另外附上。'));});
 panel.querySelector('[data-material=export]').onclick=()=>run(async()=>{const path=await invoke('materials_export');output.textContent=t('匯出位置')+'：'+path;message(t('素材包已匯出'));});
 function render(){
  list.replaceChildren();if(!items.length){const empty=document.createElement('p');empty.className='material-empty';empty.textContent=t('尚無素材。先截一張圖，或加入文字與檔案。');list.append(empty);}
  items.forEach((item,index)=>{
   const card=document.createElement('article');card.className='material-card';card.setAttribute('role','listitem');card.dataset.id=item.id;const preview=document.createElement('button');preview.type='button';preview.className='material-select';preview.textContent=t('預覽');preview.setAttribute('aria-label',t('預覽素材')+' '+(index+1));preview.onclick=()=>{selectedId=item.id;inspect();};
   const head=document.createElement('div');head.className='material-card-head';const title=document.createElement('strong');title.textContent=`${String(index+1).padStart(2,'0')} · ${item.kind==='text'?t('任務文字'):item.name}`;head.append(title,preview);
   for(const [label,delta]of [['上移素材',-1],['下移素材',1],['移除素材',0]]){const button=document.createElement('button');button.type='button';button.textContent=t(label);button.setAttribute('aria-label',t(label)+` ${index+1}`);button.disabled=delta<0&&index===0||delta>0&&index===items.length-1;button.onclick=()=>run(async()=>{items=(await invoke(delta?'materials_order':'materials_remove',delta?{ids:moveMaterial(items,item.id,delta)}:{itemId:item.id})).items;render();});head.append(button);}card.append(head);
   if(item.kind==='text'){const text=document.createElement('textarea');text.setAttribute('aria-label',t('任務文字')+` ${index+1}`);text.placeholder=t('描述這次希望 AI 完成的任務…');text.maxLength=100000;text.value=pending.get(item.id)??item.text;text.oninput=()=>updateText(item.id,text.value);card.append(text);}
   else if(item.kind==='image'){const img=document.createElement('img');img.alt=item.name;img.loading='lazy';img.decoding='async';card.append(img);source(item).then(src=>{if(img.isConnected)img.src=src;}).catch(e=>message(t('素材操作失敗')+'：'+errorMessage(e)));}
   else if(/\.(webm|mp4)$/i.test(item.name)){
    const video=document.createElement('video');video.onplay=()=>pauseOthers(video);video.controls=true;video.preload='metadata';video.playsInline=true;video.setAttribute('aria-label',t('影片預覽')+' '+item.name);
    const failure=document.createElement('p');failure.className='material-media-error';failure.setAttribute('role','status');failure.hidden=true;
    const fail=e=>{if(!video.isConnected)return;failure.hidden=false;failure.textContent=t('無法播放影片，請匯出素材包後以外部播放器開啟。')+(e?' '+errorMessage(e):'');};
    video.addEventListener('error',()=>fail());card.append(video,failure);source(item).then(src=>{if(video.isConnected)video.src=src;}).catch(fail);
   }
   else{const details=document.createElement('p');details.textContent=t('附件')+` · ${(item.size/1024).toFixed(1)} KB`;card.append(details);}list.append(card);
  });inspect();
 }
 listen('capture-error',event=>message(errorMessage(event.payload))).catch(e=>message(errorMessage(e)));
 listen('materials-updated',()=>{queue.then(()=>run(reload));}).catch(e=>message(String(e)));
 onLanguageChange(()=>{if(!panel.hidden)render();});
 return {panel,get busy(){return busy;},async open(){panel.hidden=false;return run(async()=>{try{await reload();await access.refresh();await tools.refresh();message(t('素材已儲存'));}catch(e){loadFailed=true;list.replaceChildren();throw e;}});},async flush(){try{await queue;await flushInternal();}catch(e){message(t('素材操作失敗')+'：'+errorMessage(e));throw e;}},hasPending:()=>pending.size>0||loadFailed};
}
