// Run against a hidden --design-preview build only; never sends OS keyboard/mouse events.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getRoleDefaults } from '../src/roles.js';
const { chromium } = await import(process.env.BEFORE_YOU_DO_PLAYWRIGHT_MODULE ?? 'playwright');
const port=process.argv[2]??'9264';
fs.mkdirSync('artifacts',{recursive:true});
const original=process.env.APPDATA+'/dev.quicksay.desktop';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const before=Object.fromEntries(fs.readdirSync(original).filter(f=>f.endsWith('.json')||f.endsWith('.bak')).map(f=>[f,hash(original+'/'+f)]));
const b=await chromium.connectOverCDP(`http://localhost:${port}`),p=b.contexts()[0].pages().find(p=>!p.url().includes('picker'));
const call=(cmd,args={})=>p.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});
const click=s=>p.locator(s).evaluate(e=>e.click());
const input=(s,v)=>p.locator(s).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))},v);
const choose=async role=>{await click(`[data-role=${role}]`);await p.waitForFunction(role=>document.querySelector(`[data-role=${role}]`).getAttribute('aria-pressed')==='true'&&!document.querySelector(`[data-role=${role}]`).disabled,role)};
const save=async()=>{await p.locator('#editor').evaluate(e=>e.requestSubmit());await p.waitForFunction(()=>!document.querySelector('#editor').inert)};
const reload=async(confirm=true)=>{await click('.settings-link');await click('[data-settings=reload]');if(await p.locator('dialog[open]').count())await click(confirm?'.dialog-confirm':'.dialog-cancel');await click('[data-settings=back]')};
const errors=[];p.on('pageerror',e=>errors.push(String(e)));
try{
 await p.locator('#scenario').waitFor({state:'attached'});assert((await call('storage_info')).path.includes('quicksay-design-preview-'));
 await choose('personal');await call('save_snippets',{items:getRoleDefaults('personal','zh-TW')});await p.reload();await p.locator('#scenario').waitFor({state:'attached'});
 await click('.settings-link');await p.locator('#language').evaluate(e=>{e.value='zh-TW';e.dispatchEvent(new Event('change',{bubbles:true}))});await click('[data-settings=back]');
 const originalSaved=await call('get_snippets');
 // A named draft does not block saving another complete snippet, and can be located.
 await click('#add');await input('#name','等待補正文');await input('#scenario','保留草稿情境');await click('#add');await input('#name','可儲存');await input('#text','完整正文');await input('#scenario','適合測試');await save();
 let saved=await call('get_snippets');assert.equal(saved.at(-1).name,'可儲存');assert(!saved.some(i=>i.name==='等待補正文'));
 assert((await p.locator('#save-status').textContent()).includes('1 筆草稿待完成'));assert(await p.locator('[data-role=personal]').evaluate(e=>e.classList.contains('has-unsaved')));
 assert((await p.locator('.save-issue').textContent()).includes('等待補正文'));await input('#search','可儲存');await click('.save-issue');assert.equal(await p.locator('#search').inputValue(),'');assert.equal(await p.locator('#name').inputValue(),'等待補正文');assert.equal(await p.evaluate(()=>document.activeElement.id),'text');assert.equal(await p.locator('#text').getAttribute('aria-invalid'),'true');assert.equal(await p.locator('#scenario').inputValue(),'保留草稿情境');
 // Switching preserves drafts and status; other unsaved roles are named and linked.
 await choose('developer');assert((await p.locator('.role-save-overview').textContent()).includes('其他未儲存角色'));assert((await p.locator('#save-status').textContent()).includes('目前角色：程式開發'));
 await input('#text','開發尚未儲存');await choose('personal');assert((await p.locator('.role-save-overview').textContent()).includes('程式開發'));assert.equal(await p.locator('#name').inputValue(),'等待補正文');
 await call('request_quit');await p.locator('dialog[open]').waitFor({state:'attached'});const message=await p.locator('#confirmation-message').textContent();assert(message.includes('我的短句')&&message.includes('程式開發'));await click('.dialog-cancel');assert.equal(await call('preview_quit_approved'),false);assert.equal(await p.locator('#scenario').inputValue(),'保留草稿情境');
 // Cancellation of reload must preserve both drafts and role states.
 await reload(false);assert.equal(await p.locator('#name').inputValue(),'等待補正文');
 await input('#text','補齊的正文');await p.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',code:'KeyS',ctrlKey:true,bubbles:true,cancelable:true})));await p.waitForFunction(()=>!document.querySelector('#editor').inert&&document.querySelector('.save-issues').hidden);assert.equal(await p.locator('.save-issue').count(),0);assert.equal(await p.locator('#text').getAttribute('aria-invalid'),'false');saved=await call('get_snippets');assert(saved.some(i=>i.name==='等待補正文'&&i.scenario==='保留草稿情境'));
 // An incomplete edit to an existing saved item retains its last persisted version.
 await input('#text','');await save();assert((await p.locator('.save-issue').textContent()).includes('保留上次已儲存版本'));assert.equal((await call('get_snippets')).find(i=>i.name==='等待補正文').text,'補齊的正文');assert.equal(await p.locator('#text').inputValue(),'');
 await input('#text','再次補齊');await save();await reload();assert.equal((await call('get_snippets')).find(i=>i.name==='等待補正文').text,'再次補齊');
 // Reordering changes the picker order only after save. Picker commits still return just text.
 await p.locator('.snippet').last().evaluate(e=>e.click());await click('.sort-tools button:first-of-type');await save();await call('preview_picker',{action:'begin'});const snapshot=await call('picker_state');assert.deepEqual(snapshot.items,await call('get_snippets'));const result=await call('preview_picker',{action:'commit'});assert.equal(result.text,snapshot.items[0].text);
 // Existing role drafts remain visible in the exit guard even when current role is saved.
 await call('request_quit');await p.locator('dialog[open]').waitFor({state:'attached'});assert((await p.locator('#confirmation-message').textContent()).includes('程式開發'));await call('request_quit');assert.equal(await p.locator('dialog[open]').count(),1);await p.locator('dialog[open]').evaluate(e=>e.dispatchEvent(new Event('cancel',{cancelable:true})));assert.equal(await call('preview_quit_approved'),false);
 await choose('developer');assert.equal(await p.locator('#text').inputValue(),'開發尚未儲存');await save();await choose('personal');assert(!(await p.locator('.role-save-overview').textContent()).includes('其他未儲存角色'));
 // Reproduce all-new invalid-only drafts: no disk write, exact missing-field markers.
 await call('save_snippets',{items:[{name:'暫存測試',text:'舊文'}]});await reload();await click('#add');await input('#name','只有草稿');await p.locator('.snippet').first().evaluate(e=>e.click());await click('#delete');await click('.dialog-confirm');const diskBefore=hash((await call('storage_info')).path);await save();assert((await p.locator('#save-status').textContent()).includes('沒有可儲存'));assert.equal(hash((await call('storage_info')).path),diskBefore);await click('.save-issue');assert.equal(await p.evaluate(()=>document.activeElement.id),'text');
 // Screenshots with errors and multi-role changes, including four-language labels.
 await choose('developer');await input('#text','另一角色的草稿');await choose('personal');
 const cdp=await b.contexts()[0].newCDPSession(p);for(const [width,height] of [[940,820],[780,680]]){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});const rects=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom}};return {actions:rect('.form-actions'),usage:rect('.usage-bar'),width:document.documentElement.scrollWidth}});assert(rects.actions.bottom<=rects.usage.top+1);assert(rects.width<=width);await p.screenshot({path:`artifacts/save-workflow-${width}x${height}.png`})}
 await click('.settings-link');for(const language of ['en','ja','zh-CN','zh-TW']){await p.locator('#language').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},language);assert((await call('get_snippets'))[0].text==='舊文')};await click('[data-settings=back]');
 await call('request_quit');await p.locator('dialog[open]').waitFor({state:'attached'});await p.screenshot({path:'artifacts/save-workflow-quit.png'});await click('.dialog-confirm');assert.equal(await call('preview_quit_approved'),true);
 assert.deepEqual(errors,[]);for(const [f,h]of Object.entries(before))assert.equal(hash(original+'/'+f),h);
 console.log('PASS: partial saves, issue location, saved-version retention, roles/drafts, reload/cancel, reorder/picker, exit/cancel/confirm, 4 languages, layouts; original files unchanged.');
}finally{await b.close()}

