import {readFileSync} from 'node:fs';
import {test,expect} from './fixture.js';
async function open(page,items=[],language='zh-TW'){
 await page.addInitScript(({items,language})=>{localStorage.setItem('quicksay.language',language);localStorage.setItem('qa.disk',JSON.stringify({role:'personal',files:{personal:[{name:'Keep',text:'My draft'}]},materials:{items}}));},{items,language});
 await page.setViewportSize({width:640,height:650});await page.goto('/?materials-quick');await expect(page.getByRole('listbox')).toBeVisible();await page.evaluate(async({items,language})=>{(await import('/src/i18n.js')).setLanguage(language);qa.state.materials={items};qa.emit('materials-quick-refresh');},{items,language});await expect(page.getByRole('option')).toHaveCount(items.length);
}
const item=(id,kind='text',name='Task '+id)=>({id:String(id),kind,name,text:'Text '+id,size:123});
test('list numbering, keyboard selection, preview and two-level Escape',async({page})=>{
 await open(page,[item(1),item(2),item(3)]);const rows=page.getByRole('option');await expect(rows).toHaveCount(3);await expect(rows.nth(0)).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('ArrowDown');await expect(rows.nth(1)).toHaveAttribute('aria-selected','true');await page.keyboard.press('End');await expect(rows.nth(2)).toHaveAttribute('aria-selected','true');await page.keyboard.press('Home');await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toContainText('Text 1');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.keyboard.down('Alt');await page.keyboard.up('Alt');expect(await page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_quick_action').length)).toBe(0);
 await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_quick_action').at(-1)?.args.action)).toBe('close');
});
test('empty, read failure and retry are actionable',async({page})=>{
 await open(page);await expect(page.getByText('目前沒有素材',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/整包貼上/})).toBeDisabled();
 await page.evaluate(()=>{qa.failures.materials_quick_snapshot='Read failed';qa.emit('materials-quick-refresh');});await expect(page.getByRole('status')).toContainText('Read failed');
 await page.evaluate(()=>{delete qa.failures.materials_quick_snapshot;qa.state.materials.items=[{id:'a',kind:'text',name:'Recovered',text:'ok'}];});await page.getByRole('button',{name:'重新載入'}).click();await expect(page.getByRole('option')).toHaveCount(1);
});
test('untrusted names stay text; refresh preserves selection and numbering',async({page})=>{
 await open(page,[item(1),item(2,'text','<script>window.bad=true</script>')]);await page.keyboard.press('End');await page.evaluate(()=>{qa.state.materials.items.unshift({id:'0',kind:'file',name:'first.pdf',size:20});qa.emit('materials-updated');});await expect(page.getByRole('option').nth(2)).toHaveAttribute('aria-selected','true');await expect(page.getByRole('option').nth(2)).toHaveAccessibleName('03 · <script>window.bad=true</script>');expect(await page.evaluate(()=>window.bad)).toBeUndefined();
 await page.evaluate(()=>{qa.state.materials.items.pop();qa.emit('materials-updated');});await expect(page.getByRole('option').nth(0)).toHaveAttribute('aria-selected','true');
});
test('image preview, file metadata and preview failure retry',async({page})=>{
 await open(page,[item(1,'image','shot.png'),item(2,'file','spec.pdf')]);await page.keyboard.press('Enter');await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();await page.keyboard.press('Escape');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toContainText('請在主視窗查看此檔案。');await page.keyboard.press('Escape');
 await page.evaluate(()=>qa.failures.materials_preview='Preview failed');await page.keyboard.press('Home');await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toContainText('Preview failed');await page.evaluate(()=>delete qa.failures.materials_preview);await page.getByRole('dialog').getByRole('button',{name:'重新載入'}).click();await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
});
for(const [language,label]of [['zh-TW','整包貼上'],['zh-CN','整包粘贴'],['en','Paste all'],['ja','すべて貼り付け']])test('language and compact viewport '+language,async({page})=>{
 await open(page,[item(1,'text','Very long '.repeat(100))],language);await page.setViewportSize({width:380,height:480});const paste=page.getByRole('button',{name:new RegExp(label)});await expect(paste).toBeVisible();await paste.click();await paste.evaluate(button=>button.click());expect(await page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_quick_action'&&c.args.action==='paste').length)).toBe(1);await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>qa.calls.at(-1)?.args.action)).toBe('close');
});

test('video decodes and closing preview stops and unloads media',async({page})=>{
 await open(page,[item(1,'file','movie.webm')]);const source='data:video/webm;base64,'+readFileSync(new URL('../fixtures/material-video.webm',import.meta.url)).toString('base64');await page.evaluate(source=>qa.mediaPreviews={'1':source},source);await page.keyboard.press('Enter');const video=page.getByLabel('movie.webm',{exact:true});await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1);await video.evaluate(async v=>{window.previousVideo=v;v.muted=true;await v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(0);await page.keyboard.press('Escape');expect(await page.evaluate(()=>({paused:previousVideo.paused,src:previousVideo.getAttribute('src'),connected:previousVideo.isConnected}))).toEqual({paused:true,src:null,connected:false});
});

test('six rows and actions fit the selected concept at its default size',async({page})=>{
 await open(page,Array.from({length:6},(_,i)=>item(i+1)));await expect(page.getByRole('option').last()).toBeInViewport({ratio:1});await expect(page.getByRole('button',{name:/整包貼上/})).toBeInViewport({ratio:1});await page.screenshot({path:'artifacts/materials-quick-list.png'});
});

test('footer buttons keep native Enter activation instead of opening a preview',async({page})=>{
 await open(page,[item(1)]);const button=page.getByRole('button',{name:'開啟主視窗',exact:true});await button.focus();await button.press('Enter');await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_quick_action').at(-1)?.args.action)).toBe('main');await expect(page.getByRole('dialog')).toHaveCount(0);
});
