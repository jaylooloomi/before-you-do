// Real WebView + native alpha handshake. No OS keyboard/mouse events or clipboard.
import {spawn,execFileSync} from 'node:child_process';import {mkdirSync,writeFileSync} from 'node:fs';import {resolve,join} from 'node:path';import net from 'node:net';import assert from 'node:assert/strict';import {chromium,expect} from '@playwright/test';
const output=resolve(`artifacts/native-capture-presentation-${Date.now()}`);mkdirSync(output,{recursive:true});const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const child=spawn(resolve('src-tauri/target/release/before-you-do.exe'),['--design-preview','--autostart','--capture-presentation-test'],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:join(output,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`}});let browser;
try{
 await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${port}/json/version`)).ok}catch{return false}},{timeout:20000}).toBe(true);browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);await expect.poll(()=>browser.contexts().flatMap(c=>c.pages()).some(p=>p.url().includes('recording-controls')),{timeout:15000}).toBe(true);
 const pages=browser.contexts().flatMap(c=>c.pages()),main=pages.find(p=>!/[?](picker|capture-region|recording-controls)/.test(p.url())),overlay=pages.find(p=>p.url().includes('capture-region'));assert(main&&overlay);const errors=[];for(const p of pages){p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
 const call=(p,cmd,args={})=>p.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});
 await expect.poll(()=>overlay.evaluate(()=>!!document.querySelector('.capture-loupe'))).toBe(true);
 await overlay.evaluate(()=>{window.__presentAudit={};const originalDecode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=async function(){await originalDecode.call(this);if(window.__presentAudit.decodeGate)await window.__presentAudit.decodeGate;};});
 const cycles=[];
 for(let index=0;index<3;index++){
  await call(main,'preview_capture_gate',{hold:true});await overlay.evaluate(()=>{const a=window.__presentAudit;a.decodeGate=new Promise(r=>a.decodeRelease=r);});
  const started=call(main,'preview_capture_start').then(()=>({ok:true}),e=>({ok:false,error:String(e)}));
  await expect.poll(()=>call(main,'preview_capture_presentation').then(v=>v.busy)).toBe(true);
  await expect.poll(()=>call(overlay,'capture_frame').then(v=>v.session).catch(()=>0),{timeout:10000}).toBeGreaterThan(0);
  const before=await call(main,'preview_capture_presentation');assert.equal(before.visible,false,'No native window before bitmap decode');
  const frame=await call(overlay,'capture_frame');assert(frame.pointer.every(Number.isFinite));await overlay.evaluate(()=>window.__presentAudit.decodeRelease());
  await expect.poll(()=>call(main,'preview_capture_presentation').then(v=>v.stage),{timeout:10000}).toBe(1);
  const primed=await call(main,'preview_capture_presentation');writeFileSync(join(output,`cycle-${index}-primed.json`),JSON.stringify(primed));assert(primed.visible);assert.equal(primed.alpha,0,'Compositor warmup must be fully transparent');const owner=Number(execFileSync(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-File',resolve('scripts/native-window-owner.ps1'),'-WindowHandle',String(primed.foreground)],{encoding:'utf8',windowsHide:true}).trim());assert.notEqual(owner,child.pid,'Warmup must not activate any preview window');
  await expect(overlay.getByRole('figure',{name:/像素放大鏡|Pixel magnifier/,exact:true})).toBeVisible();assert(await overlay.getByRole('img').evaluate(img=>img.complete&&img.naturalWidth>0));
  await overlay.screenshot({path:join(output,`cycle-${index}-prepared.png`)});
  await call(main,'preview_capture_gate',{hold:false});assert.deepEqual(await started,{ok:true});const shown=await call(main,'preview_capture_presentation');assert.equal(shown.stage,2);assert.equal(shown.alpha,255);assert(shown.visible);
  await overlay.screenshot({path:join(output,`cycle-${index}-visible.png`)});await call(overlay,'capture_finish',{rect:null,session:null});await expect.poll(()=>call(main,'preview_capture_presentation').then(v=>v.visible)).toBe(false);cycles.push({session:shown.session,hiddenUntilDecoded:true,primedAlpha:primed.alpha,presentedAlpha:shown.alpha,initialPointer:frame.pointer,magnifier:true});
 }
 // Cancellation during decode must make a late prime/present harmless.
 await overlay.evaluate(()=>{const a=window.__presentAudit;a.decodeGate=new Promise(r=>a.decodeRelease=r);a.presentGate=null;});const cancelled=call(main,'preview_capture_start').catch(()=>{});await expect.poll(()=>call(main,'preview_capture_presentation').then(v=>v.busy)).toBe(true);await expect.poll(()=>call(overlay,'capture_frame').then(v=>v.session).catch(()=>0)).toBeGreaterThan(0);await call(overlay,'capture_finish',{rect:null,session:null});await overlay.evaluate(()=>window.__presentAudit.decodeRelease());await cancelled;await expect.poll(()=>call(main,'preview_capture_presentation').then(v=>v.visible)).toBe(false);
 assert.deepEqual(errors,[]);const report={cycles,cancelDuringDecode:true,runtimeErrors:errors,desktopInput:false,clipboard:false};writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();child.kill();}
