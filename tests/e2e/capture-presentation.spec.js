import {readFileSync} from 'node:fs';import {test,expect} from './fixture.js';
const image='data:image/png;base64,'+readFileSync(new URL('../fixtures/capture-desktop.png',import.meta.url)).toString('base64');
const frame={session:60,width:1920,height:1080,origin:[-1920,-50],pointer:[250,240],image,candidates:[]};
async function preload(page){await page.goto('/?capture-region');await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='plugin:event|listen'&&c.args.event==='capture-ready'))).toBe(true);}
async function deliver(page,next=frame){await page.evaluate(next=>{window.qa.frame=next;window.qa.emit('capture-ready',next.session);},next);}
test('first prepared frame has a magnifier at the native cursor without any pointer movement',async({page})=>{
 await preload(page);await deliver(page);await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_present'&&c.args.session===60))).toBe(true);
 await expect(page.getByRole('figure',{name:'像素放大鏡'})).toBeVisible();await expect(page.getByLabel('游標座標與色彩')).toContainText('X: -1670  Y: 190');await expect(page.getByLabel('游標座標與色彩')).toContainText('#22C55E');await expect(page.getByRole('img')).toHaveAttribute('src',image);await page.screenshot({path:'artifacts/capture-first-frame.png'});
});
test('native presentation waits for decode and prime, with no old frame or black background',async({page})=>{
 await preload(page);await page.evaluate(()=>{const original=HTMLImageElement.prototype.decode;window.qa.decodeGate={};window.qa.decodeGate.promise=new Promise(r=>window.qa.decodeGate.release=r);HTMLImageElement.prototype.decode=async function(){await original.call(this);await window.qa.decodeGate.promise;};window.qa.hold('capture_prime');});await deliver(page);
 await expect(page.getByRole('img')).toBeHidden();expect(await page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_prime'&&c.args.session===60))).toBe(false);expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 await page.evaluate(()=>window.qa.decodeGate.release());await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_prime'&&c.args.session===60))).toBe(true);expect(await page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_present'&&c.args.session===60))).toBe(false);await expect(page.getByRole('figure',{name:'像素放大鏡'})).toBeVisible();await page.evaluate(()=>window.qa.release('capture_prime'));await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_present'&&c.args.session===60))).toBe(true);
});
test('reopening replaces the initial cursor and respects a disabled magnifier',async({page})=>{
 await preload(page);await deliver(page);await expect(page.getByLabel('游標座標與色彩')).toContainText('X: -1670');await deliver(page,{...frame,session:61,pointer:[1300,600]});await expect(page.getByLabel('游標座標與色彩')).toContainText('X: -620  Y: 550');await page.evaluate(()=>localStorage.setItem('before-you-do.capture.magnifier','false'));await deliver(page,{...frame,session:62});await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_present'&&c.args.session===62))).toBe(true);await expect(page.getByRole('figure',{name:'像素放大鏡'})).toBeHidden();
});
test('a prime failure reports preparation failure and never presents that session',async({page})=>{
 await preload(page);await page.evaluate(()=>window.qa.failures.capture_prime='Capture prime fixture failed');await deliver(page);await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_prepare_failed'&&c.args.session===60))).toBe(true);expect(await page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='capture_present'&&c.args.session===60))).toBe(false);
});
