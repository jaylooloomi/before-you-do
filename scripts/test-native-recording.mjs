// Explicit native capture/encoding audit. Hidden isolated app, no desktop input or clipboard.
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readdirSync,statSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
if(process.platform!=='win32')throw new Error('Windows recording audit only');
const output=resolve(`artifacts/native-recording-${Date.now()}`);mkdirSync(output,{recursive:true});
const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const child=spawn(resolve('src-tauri/target/release/before-you-do.exe'),['--design-preview','--autostart','--recording-test','--capture-hotkeys-test'],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:join(output,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`}});
let browser;let mainPage;let reservation;const report={desktopInput:false,clipboard:false,formats:[]};
try{
 await expect.poll(async()=>{try{return(await fetch(`http://127.0.0.1:${port}/json/version`)).ok}catch{return false}},{timeout:20000}).toBe(true);
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 await expect.poll(()=>browser.contexts().flatMap(c=>c.pages()).some(p=>p.url().includes('capture-region')),{timeout:15000}).toBe(true);
 const pages=browser.contexts().flatMap(c=>c.pages()),page=pages.find(p=>!p.url().includes('picker')&&!p.url().includes('capture-region')),overlay=pages.find(p=>p.url().includes('capture-region'));assert(page&&overlay);
 mainPage=page;
 const errors=[];for(const p of pages){p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
 const call=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
 await expect.poll(()=>call('recording_state').then(v=>v.runtime_ready)).toBe(true);
 const keys={region:'Ctrl+Alt+Shift+F10',fullscreen:'',window:'',video:'',gif:''};
 await expect.poll(async()=>{try{return (await call('capture_hotkeys_save',{config:keys})).registered}catch{return false}}).toBe(true);
 await assert.rejects(()=>call('capture_hotkeys_save',{config:{...keys,video:keys.region}}),/different/);
 assert.deepEqual((await call('capture_hotkeys_get')).config,keys);
 await assert.rejects(()=>call('capture_hotkeys_save',{config:{...keys,region:'Alt+H'}}),/PrintScreen|F6/);
 const reservationPS=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 reservation=spawn(reservationPS,['-NoProfile','-NonInteractive','-File',resolve('scripts/hold-recording-test-hotkey.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 await new Promise((resolveReady,reject)=>{let text='';reservation.stdout.on('data',chunk=>{text+=chunk;if(text.includes('READY'))resolveReady();});reservation.on('exit',code=>{if(!text.includes('READY'))reject(new Error('Hotkey fixture exited: '+code));});reservation.on('error',reject);});
 await assert.rejects(()=>call('capture_hotkeys_save',{config:{...keys,region:'Ctrl+Alt+Shift+F11'}}),/conflict/);
 assert.deepEqual((await call('capture_hotkeys_get')).config,keys);assert((await call('capture_hotkeys_get')).registered);
 reservation.stdin.end('\n');reservation=null;report.nativeConflictRollback=true;
 await call('capture_hotkeys_save',{config:{region:'',fullscreen:'',window:'',video:'',gif:''}});
 report.nativeShortcutRegistration=true;

 await assert.rejects(()=>overlay.evaluate(()=>window.__TAURI_INTERNALS__.invoke('preview_recording',{format:'video'})),/Isolated recording test/);
 const data=join(process.env.TEMP,`quicksay-design-preview-${child.pid}`,'prompt-materials');
 const storage=await call('storage_info');const materials=join(resolve(storage.path,'..'),'prompt-materials');
 assert(materials.includes(`quicksay-design-preview-${child.pid}`),'No user material path');
 for(const format of ['video','gif']){
  await call('preview_recording',{format});
  await assert.rejects(()=>call('preview_recording',{format}),/already in progress/);
  await assert.rejects(()=>call('capture_start',{mode:'region'}),/already in progress/);

  // Wait on the actual encoder file, then stop via normal IPC. No fixed test sleep.
  await expect.poll(()=>{const dir=join(materials,'recordings-pending');return existsSync(dir)&&readdirSync(dir).length>0;},{timeout:20000}).toBe(true);
  await assert.rejects(()=>call('confirm_quit'),/finalized/);
  await call('recording_stop');
  await expect.poll(()=>call('recording_state').then(v=>v.status.phase),{timeout:25000}).toBe('saved');
  const bundle=await call('materials_load'),item=bundle.items.at(-1);assert(item.name.endsWith(format==='gif'?'.gif':'.webm'));
  assert(item.size>0&&item.size<=25*1024*1024);assert.equal(item.kind,format==='gif'?'image':'file');
  const exported=await call('materials_export');const entry=readdirSync(exported).find(n=>n.endsWith(format==='gif'?'.gif':'.webm'));assert(entry);
  const encoded=join(exported,entry);const ffprobe=join(process.env.LOCALAPPDATA,'before-you-do/recording-runtime/ffmpeg-8.1-0448c3f3/bin/ffprobe.exe');
  const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',encoded],{encoding:'utf8',windowsHide:true}));
  assert.equal(probe.streams.filter(s=>s.codec_type==='audio').length,0);const video=probe.streams.find(s=>s.codec_type==='video');assert(video&&video.width>=2&&video.height>=2);assert.equal(video.codec_name,format==='gif'?'gif':'vp8');
  const ffmpeg=ffprobe.replace('ffprobe.exe','ffmpeg.exe');execFileSync(ffmpeg,['-v','error','-i',encoded,'-f','null','-'],{windowsHide:true,stdio:'pipe'});
  if(format==='gif')assert((await call('materials_preview',{itemId:item.id})).startsWith('data:image/gif;base64,'));
  report.formats.push({format,codec:video.codec_name,width:video.width,height:video.height,size:item.size,decoded:true,exported:true});
 }
 assert.deepEqual(errors,[]);report.runtimeErrors=errors.length;
 await call('preview_recording',{format:'video'});
 const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const encoderPid=()=>Number(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process -Filter "name='ffmpeg.exe'" | Where-Object ParentProcessId -eq ${child.pid} | Select-Object -First 1 -ExpandProperty ProcessId`],{encoding:'utf8',windowsHide:true}).trim());
 await expect.poll(encoderPid).toBeGreaterThan(0);const recordedPid=encoderPid();child.kill();mainPage=null;
 await expect.poll(()=>{try{process.kill(recordedPid,0);return true}catch{return false}},{timeout:10000}).toBe(false);report.crashCleanup=true;

 writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{reservation?.kill();if(mainPage){await mainPage.evaluate(()=>window.__TAURI_INTERNALS__.invoke('recording_stop')).catch(()=>{});await expect.poll(()=>mainPage.evaluate(()=>window.__TAURI_INTERNALS__.invoke('recording_state')).then(v=>['saved','error',''].includes(v.status.phase)),{timeout:20000}).toBe(true).catch(()=>{});}await browser?.close();child.kill();}
