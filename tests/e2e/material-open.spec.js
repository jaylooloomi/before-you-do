import {test,expect,Manager} from './fixture.js';import {readFileSync} from 'node:fs';
const image='data:image/png;base64,'+readFileSync(new URL('../fixtures/reference-login.png',import.meta.url)).toString('base64');
const video='data:video/webm;base64,'+readFileSync(new URL('../fixtures/material-video.webm',import.meta.url)).toString('base64');
async function open(page){const m=new Manager(page);await m.open();await m.text.fill('草稿不變');await page.evaluate(({image,video})=>{qa.state.materials={items:[{id:'photo',name:'photo.png',kind:'image',text:'',size:3},{id:'clip',name:'clip.webm',kind:'file',text:'',size:3},{id:'doc',name:'notes.txt',kind:'file',text:'',size:3},{id:'text',name:'Text',kind:'text',text:'文字草稿',size:0}]};qa.mediaPreviews={photo:image,clip:video};},{image,video});await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();return m;}
test('double clicks on image, video and file request default app; text stays editable',async({page})=>{
 const m=await open(page);await page.getByAltText('photo.png',{exact:true}).dblclick();await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_open').at(-1)?.args.itemId)).toBe('photo');
 await page.getByRole('button',{name:'預覽素材 2',exact:true}).dblclick();await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_open').at(-1)?.args.itemId)).toBe('clip');
 await page.getByRole('listitem',{name:'03 · notes.txt',exact:true}).getByText('TXT',{exact:true}).dblclick();await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_open').at(-1)?.args.itemId)).toBe('doc');
 const count=await page.evaluate(()=>qa.count('materials_open'));await page.getByRole('textbox',{name:'任務文字 4',exact:true}).dblclick();expect(await page.evaluate(()=>qa.count('materials_open'))).toBe(count);await expect(page.getByRole('textbox',{name:'任務文字 4',exact:true})).toHaveValue('文字草稿');
 await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('草稿不變');
});
test('opening failure shows error without removing assets and pending open suppresses duplicates',async({page})=>{
 await open(page);await page.evaluate(()=>qa.hold('materials_open'));const img=page.getByAltText('photo.png',{exact:true});await img.dblclick();await img.dispatchEvent('dblclick');expect(await page.evaluate(()=>qa.count('materials_open'))).toBe(1);await page.evaluate(()=>qa.release('materials_open'));await expect(page.getByRole('button',{name:'加入文字',exact:true})).toBeEnabled();await page.evaluate(()=>qa.failures.materials_open='No default app');await img.dblclick();await expect(page.getByText(/素材操作失敗.*No default app/)).toBeVisible();expect(await page.evaluate(()=>qa.state.materials.items.length)).toBe(4);
});
