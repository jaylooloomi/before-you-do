import {test,expect} from '@playwright/test';
test('screenshot preview renders latest image and closes through native command without focus',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://127.0.0.1:5187/toast-test',route=>route.fulfill({contentType:'text/html',body:'<div id="app"></div>'}));
 await page.setViewportSize({width:320,height:220});await page.goto('/toast-test');
 await page.evaluate(async()=>{const {mountCaptureToast}=await import('/src/capture-toast.js');window.calls=[];await mountCaptureToast(document.querySelector('#app'),{invoke:async(cmd,args)=>window.calls.push({cmd,args}),listen:async(_,fn)=>window.preview=fn});const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#202020';x.fillRect(0,0,640,360);x.fillStyle='#9bc9ff';x.font='32px sans-serif';x.fillText('before-you-do',30,70);window.preview({payload:{generation:1,image:c.toDataURL()}});});
 await expect.poll(()=>page.evaluate(()=>window.calls)).toEqual([{cmd:'capture_toast_ready',args:{generation:1}}]);const image=page.getByRole('img',{name:'Screenshot preview'});await expect(image).toBeVisible();expect(await image.evaluate(i=>i.naturalWidth)).toBe(640);await page.screenshot({path:'artifacts/capture-toast-preview.png'});await page.getByRole('button',{name:'Close preview'}).click();await expect.poll(()=>page.evaluate(()=>window.calls.at(-1).cmd)).toBe('capture_toast_hide');expect(errors).toEqual([]);
});
