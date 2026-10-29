// Native Tauri IPC smoke test: no desktop input, clipboard access or visible window.
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
if(process.platform!=='win32')throw new Error('Run the Windows IPC audit on Windows');
const binary=resolve(process.argv[2]||'src-tauri/target/release/before-you-do.exe');
const output=resolve(process.argv[3]||`artifacts/native-capture-ipc-${Date.now()}`);
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
 const caps=await call(main,'capture_capabilities');assert.equal(caps.platform,'windows');assert.equal(caps.permission,'not_required');assert(caps.supported);
 await assert.rejects(()=>call(main,'capture_start',{mode:'invalid'}),/error.capture_mode/);
 await assert.rejects(()=>call(overlay,'capture_finish',{rect:[0,0,1,1],session:99999}),/error.capture_session/);
 assert.equal((await call(main,'materials_load')).items.length,0);
 const first=await call(main,'materials_text',{itemId:null,text:'Isolated native IPC fixture'});
 const second=await call(main,'materials_import',{name:'fixture.txt',bytes:[65,66,67]});
 await call(main,'materials_order',{ids:second.items.map(i=>i.id).reverse()});
 const path=await call(main,'materials_export');
 assert(path.includes(`quicksay-design-preview-${child.pid}`),'Export must use isolated preview storage');
 await call(main,'materials_remove',{itemId:first.items[0].id});
 assert.equal((await call(main,'materials_load')).items.length,1);
 assert.equal(visibility(),0,'Rejected capture commands must not reveal a window');
 assert.deepEqual(errors,[],'Native WebViews must have no console/page errors');
 const report={nativeIPC:true,capabilities:caps,invalidModeRejected:true,staleSessionRejected:true,isolatedPersistence:true,exportVerified:true,visibleWindowCount:0,zeroRuntimeErrors:true,desktopInput:false,clipboardAccess:false};
 writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();child.kill();}
