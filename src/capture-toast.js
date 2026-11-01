export async function mountCaptureToast(root,{invoke,listen}){
 document.body.style.cssText='margin:0;background:#202020;color:#eee';
 root.style.cssText='width:100vw;height:100vh;padding:8px;box-sizing:border-box;display:flex;position:relative';
 const image=document.createElement('img');image.alt='Screenshot preview';image.style.cssText='width:100%;height:100%;object-fit:contain';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close preview');close.style.cssText='position:absolute;right:8px;top:8px;width:26px;height:26px;background:#222d;color:white;border:1px solid #888;border-radius:5px;cursor:pointer';
 root.replaceChildren(image,close);let generation=0;
 close.onclick=()=>invoke('capture_toast_hide').catch(console.error);
 await listen('capture-preview',({payload})=>{generation=payload.generation;image.onload=()=>{if(generation===payload.generation)invoke('capture_toast_ready',{generation}).catch(console.error);};image.src=payload.image;});
}
