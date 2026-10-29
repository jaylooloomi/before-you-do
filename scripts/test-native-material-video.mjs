// Native Tauri IPC smoke test: no desktop input, clipboard access or visible window.
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
if(process.platform!=='win32')throw new Error('Run the Windows IPC audit on Windows');
const binary=resolve(process.argv[2]||'src-tauri/target/release/before-you-do.exe');
const output=resolve(process.argv[3]||`artifacts/native-material-video-${Date.now()}`);
mkdirSync(output,{recursive:true});
const server=net.createServer();
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;await new Promise(r=>server.close(r));
const child=spawn(binary,['--design-preview','--autostart'],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:join(output,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`}});
let browser;
function visibility(){
 const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const value=execFileSync(ps,['-NoProfile','-NonInteractive','-File',resolve('scripts/native-capture-visibility.ps1'),'-AppProcessId',String(child.pid)],{encoding:'utf8',windowsHide:true}).trim();
 assert(/^\d+$/.test(value),'Native visibility reader must return an actual count');return Number(value);
}
try{
 await expect.poll(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok}catch{return false}},{timeout:20000}).toBe(true);
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 await expect.poll(()=>browser.contexts().flatMap(context=>context.pages()).some(page=>page.url().includes('capture-region')),{timeout:15000}).toBe(true);
 const pages=browser.contexts().flatMap(context=>context.pages());
 const errors=[];for(const page of pages){page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});}
 const main=pages.find(p=>!p.url().includes('picker')&&!p.url().includes('capture-region')&&!p.url().includes('recording-controls'));
 const overlay=pages.find(p=>p.url().includes('capture-region'));assert(main&&overlay);
 await expect.poll(()=>main.evaluate(()=>typeof window.__TAURI_INTERNALS__?.invoke)).toBe('function');
 const call=(page,command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
 const initialVisible=visibility();
 if(initialVisible)console.log(execFileSync(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-File',resolve('scripts/native-capture-visibility.ps1'),'-AppProcessId',String(child.pid),'-Details'],{encoding:'utf8',windowsHide:true}).trim());
 assert.equal(initialVisible,0,'Audit app must remain hidden');
 const bytes=[...readFileSync(resolve('tests/fixtures/material-video.webm'))];
 const imported=await call(main,'materials_import',{name:'inline-video.webm',bytes});const item=imported.items[0];assert.equal(item.kind,'file');
 assert((await call(main,'materials_preview',{itemId:item.id})).startsWith('data:video/webm;base64,'));
 await main.getByRole('button',{name:/本次 prompt 素材|Prompt workspace/,exact:true,includeHidden:true}).evaluate(button=>button.onclick());
 const video=main.getByLabel(/影片預覽 inline-video.webm|Video preview inline-video.webm/,{exact:true});
 await expect.poll(()=>video.evaluate(v=>v.readyState),{timeout:15000}).toBeGreaterThanOrEqual(1);
 assert.deepEqual(await video.evaluate(v=>[v.videoWidth,v.videoHeight,v.controls,v.paused]),[128,72,true,true]);
 await video.evaluate(async v=>{v.muted=true;await v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:10000}).toBeGreaterThan(.1);
 await video.evaluate(v=>v.pause());await video.evaluate(v=>new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=1.1;}));assert(Math.abs(await video.evaluate(v=>v.currentTime)-1.1)<.1);await video.evaluate(v=>v.volume=.35);assert.equal(await video.evaluate(v=>v.volume),.35);
 await main.screenshot({path:join(output,'native-video-player.png')});
 const after=await call(main,'materials_load');assert.deepEqual(after,imported);assert.deepEqual(errors,[]);assert.equal(visibility(),0);
 const report={nativeVideo:true,codec:'VP8/Opus WebM',decodedSize:[128,72],playbackTimeAdvanced:true,paused:true,seek:true,volume:true,autoplay:false,materialUnchanged:true,runtimeErrors:0,desktopInput:false,clipboardAccess:false,visibleWindows:0};writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();child.kill();}
