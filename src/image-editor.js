import {getLanguage} from './i18n.js';
export function imagePoint(event,rect,width,height){return {x:Math.max(0,Math.min(width,(event.clientX-rect.left)*width/rect.width)),y:Math.max(0,Math.min(height,(event.clientY-rect.top)*height/rect.height))};}
export function drawAnnotations(ctx,marks,width){
 ctx.save();ctx.lineWidth=Math.max(2,width/240);ctx.strokeStyle='#ff473d';ctx.lineCap='round';ctx.lineJoin='round';
 for(const m of marks){const x=Math.min(m.a.x,m.b.x),y=Math.min(m.a.y,m.b.y),w=Math.abs(m.b.x-m.a.x),h=Math.abs(m.b.y-m.a.y);
 if(m.tool==='redact'){ctx.fillStyle='#000';ctx.fillRect(Math.floor(x),Math.floor(y),Math.ceil(x+w)-Math.floor(x),Math.ceil(y+h)-Math.floor(y));}
 else if(m.tool==='box')ctx.strokeRect(x,y,w,h);
 else {const angle=Math.atan2(m.b.y-m.a.y,m.b.x-m.a.x),head=ctx.lineWidth*5;ctx.beginPath();ctx.moveTo(m.a.x,m.a.y);ctx.lineTo(m.b.x,m.b.y);ctx.moveTo(m.b.x-head*Math.cos(angle-.5),m.b.y-head*Math.sin(angle-.5));ctx.lineTo(m.b.x,m.b.y);ctx.lineTo(m.b.x-head*Math.cos(angle+.5),m.b.y-head*Math.sin(angle+.5));ctx.stroke();}}
 ctx.restore();
}
export async function editImage({src,onSave}){
 const en=getLanguage()==='en',label=(zh,enText)=>en?enText:zh;
 const image=new Image();image.src=src;await image.decode();
 if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>32000000)throw new Error(label('圖片過大，編輯上限為 3200 萬像素','Image exceeds the 32 megapixel editing limit'));
 const dialog=document.createElement('dialog');dialog.className='image-editor';dialog.setAttribute('aria-label',label('標註與遮蔽','Annotate and redact'));
 const title=document.createElement('h2');title.textContent=label('標註與遮蔽','Annotate and redact');
 const note=document.createElement('p');note.textContent=label('儲存會永久取代此素材，黑色遮蔽會寫入圖片像素；儲存後不能復原。原始匯入檔及先前已匯出的副本不會更改。','Save permanently replaces this material and burns black redactions into its pixels. Saved edits cannot be undone. Original imported files and previous exports remain unchanged.');
 const toolbar=document.createElement('div');toolbar.className='image-editor-tools';
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.setAttribute('aria-label',label('拖曳以標註圖片','Drag to annotate image'));
 const stage=document.createElement('div');stage.className='image-editor-stage';stage.append(canvas);
 const status=document.createElement('p');status.setAttribute('role','status');
 const footer=document.createElement('div');footer.className='image-editor-tools';
 let marks=[],draft=null,tool='redact',saving=false,pointer=null;const ctx=canvas.getContext('2d');
 const draw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);drawAnnotations(ctx,draft?[...marks,draft]:marks,canvas.width);};
 function button(text,fn,parent=toolbar){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;parent.append(b);return b;}
 const tools=[];for(const [key,zh,english]of [['redact','遮蔽','Redact'],['arrow','箭頭','Arrow'],['box','框線','Box']]){const b=button(label(zh,english),()=>{tool=key;tools.forEach(([k,b])=>b.setAttribute('aria-pressed',String(k===tool)));});tools.push([key,b]);b.setAttribute('aria-pressed',String(key===tool));}
 const undo=button(label('復原上一步','Undo'),()=>{marks.pop();draw();update();});
 const clear=button(label('清除本次編輯','Clear edits'),()=>{marks=[];draw();update();});
 const close=()=>{if(!saving){dialog.close();dialog.remove();}};
 button(label('取消','Cancel'),close,footer);
 const save=button(label('儲存並永久取代','Save and replace'),async()=>{if(saving||draft||!marks.length)return;saving=true;for(const b of dialog.querySelectorAll('button'))b.disabled=true;status.textContent=label('儲存中…','Saving…');try{draw();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||blob.size>25*1024*1024)throw new Error(label('輸出圖片超過 25 MB','Output exceeds 25 MB'));await onSave(Array.from(new Uint8Array(await blob.arrayBuffer())));saving=false;close();}catch(e){status.textContent=String(e.message||e);saving=false;for(const b of dialog.querySelectorAll('button'))b.disabled=false;update();}},footer);
 function update(){undo.disabled=clear.disabled=!marks.length;save.disabled=!marks.length||!!draft;}
 canvas.onpointerdown=e=>{if(saving||pointer!==null||e.button!==0)return;pointer=e.pointerId;canvas.setPointerCapture(pointer);const a=imagePoint(e,canvas.getBoundingClientRect(),canvas.width,canvas.height);draft={tool,a,b:a};update();};
 canvas.onpointermove=e=>{if(e.pointerId!==pointer||!draft)return;draft.b=imagePoint(e,canvas.getBoundingClientRect(),canvas.width,canvas.height);draw();};
 canvas.onpointerup=e=>{if(e.pointerId!==pointer||!draft)return;draft.b=imagePoint(e,canvas.getBoundingClientRect(),canvas.width,canvas.height);if(Math.hypot(draft.b.x-draft.a.x,draft.b.y-draft.a.y)>=1)marks.push(draft);draft=null;pointer=null;draw();update();};
 canvas.onpointercancel=canvas.onlostpointercapture=()=>{draft=null;pointer=null;draw();update();};
 dialog.oncancel=e=>{e.preventDefault();close();};dialog.append(title,note,toolbar,stage,status,footer);document.body.append(dialog);draw();update();dialog.showModal();
}
