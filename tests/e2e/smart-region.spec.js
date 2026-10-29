import {readFileSync} from 'node:fs';
import {test,expect} from './fixture.js';
const image='data:image/png;base64,'+readFileSync(new URL('../fixtures/capture-desktop.png',import.meta.url)).toString('base64');
const candidates=[{id:1,parent:0,group:1,kind:'window',rect:[100,100,600,500]},{id:2,parent:1,group:1,kind:'client',rect:[110,140,580,450]},{id:3,parent:2,group:1,kind:'control',rect:[200,200,200,150]},{id:4,parent:3,group:1,kind:'control',rect:[220,220,60,40]},{id:10,parent:0,group:10,kind:'window',rect:[50,50,1400,850]},{id:11,parent:10,group:10,kind:'control',rect:[230,230,10,10]}];
async function open(page){
 await page.goto('/?capture-region');await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='plugin:event|listen'&&c.args.event==='capture-ready'))).toBe(true);
 await page.evaluate(frame=>{window.qa.frame=frame;window.qa.emit('capture-ready',null);},{session:21,width:1920,height:1080,origin:[-1920,-50],candidates,image});
 await expect(page.getByRole('img')).toHaveAttribute('src',image);
 await page.mouse.move(120,180);
 await expect(page.getByLabel('截圖座標與尺寸')).toContainText('W: 60');
}
const selection=page=>page.getByRole('region',{name:'截圖選取範圍',exact:true});
test('hover outlines front control, brightens its area and displays real pixel magnification',async({page})=>{
 await open(page);await expect(page.getByRole('button',{name:'取消截圖',exact:true})).toBeHidden();await expect(selection(page)).toHaveCSS('border-top-style','dashed');await expect(page.getByLabel('截圖座標與尺寸')).toContainText('X: -1700');await expect(page.getByLabel('截圖座標與尺寸')).toContainText('H: 40');
 await expect(page.getByRole('figure',{name:'像素放大鏡'})).toBeVisible();
 expect(await page.getByLabel('游標像素放大預覽').evaluate(canvas=>[...canvas.getContext('2d').getImageData(68,68,1,1).data].slice(0,3))).toEqual([34,197,94]);
 await page.screenshot({path:'artifacts/smart-region-hover.png'});
});
test('single click captures candidate and Tab cycles its ancestors',async({page})=>{
 await open(page);await page.keyboard.press('Tab');await expect(page.getByLabel('截圖座標與尺寸')).toContainText('W: 200');await page.keyboard.press('Shift+Tab');await expect(page.getByLabel('截圖座標與尺寸')).toContainText('W: 60');
 await page.mouse.click(120,180);await expect.poll(()=>page.evaluate(()=>window.qa.count('capture_finish'))).toBe(1);expect(await page.evaluate(()=>window.qa.calls.find(c=>c.cmd==='capture_finish').args)).toEqual({rect:[220,220,60,40],session:21});
});
test('drag overrides hover while manual-only mode ignores automatic click selection',async({page})=>{
 await open(page);await page.evaluate(()=>{localStorage.setItem('before-you-do.capture.auto','false');window.qa.emit('capture-ready',null);});await page.mouse.move(120,180);await expect(selection(page)).toBeHidden();await page.mouse.click(120,180);expect(await page.evaluate(()=>window.qa.count('capture_finish'))).toBe(0);
 await page.evaluate(()=>{localStorage.setItem('before-you-do.capture.auto','true');window.qa.emit('capture-ready',null);});await expect(page.getByRole('img')).toHaveAttribute('src',image);await page.mouse.move(120,180);await expect(selection(page)).toBeVisible();await page.mouse.down();await page.mouse.move(300,400);await expect(selection(page)).toHaveAttribute('data-mode','manual');await page.mouse.up();await expect.poll(()=>page.evaluate(()=>window.qa.count('capture_finish'))).toBe(1);expect(await page.evaluate(()=>window.qa.calls.find(c=>c.cmd==='capture_finish').args.rect)).toEqual([245,237,368,290]);
});
test('magnifier stays inside screen edges and right-click cancels without selecting the HUD',async({page})=>{
 await open(page);await page.evaluate(()=>{localStorage.setItem('before-you-do.capture.magnifier','false');window.qa.emit('capture-ready',null);});await expect(page.getByRole('figure',{name:'像素放大鏡'})).toBeHidden();await page.evaluate(()=>{localStorage.setItem('before-you-do.capture.magnifier','true');window.qa.emit('capture-ready',null);});await page.mouse.move(939,819);await expect(page.getByRole('figure',{name:'像素放大鏡'})).toBeVisible();const box=await page.getByRole('figure',{name:'像素放大鏡'}).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(940);expect(box.y+box.height).toBeLessThanOrEqual(820);
 await page.mouse.click(900,780,{button:'right'});await expect.poll(()=>page.evaluate(()=>window.qa.count('capture_finish'))).toBe(1);expect(await page.evaluate(()=>window.qa.calls.find(c=>c.cmd==='capture_finish').args)).toEqual({rect:null,session:null});
});
test('hover aid switches with language while user screenshot pixels are not translated',async({page})=>{
 await open(page);await page.evaluate(()=>localStorage.setItem('quicksay.language','en'));await page.reload();await expect(page.getByRole('region',{name:'Capture selection',includeHidden:true})).toBeAttached();await expect(page.getByRole('button',{name:'Cancel capture',exact:true})).toBeHidden();
 await page.evaluate(()=>localStorage.setItem('quicksay.language','ja'));await page.reload();await expect(page.getByRole('region',{name:'撮影の選択範囲',includeHidden:true})).toBeAttached();
 await page.evaluate(()=>localStorage.setItem('quicksay.language','zh-CN'));await page.reload();await expect(page.getByRole('region',{name:'截图选择范围',includeHidden:true})).toBeAttached();
});
