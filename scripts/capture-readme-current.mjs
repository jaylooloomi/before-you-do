// Real frontend rendering with isolated demonstration IPC, never the user's native app.
import {spawn} from 'node:child_process';
import net from 'node:net';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {installBridge} from '../tests/e2e/bridge.js';
import {roles,getRoleDefaults} from '../src/roles.js';
import {translate} from '../src/i18n.js';

const output='docs/images/current';mkdirSync(output,{recursive:true});
const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:'ignore'});
const screenshots=[],errors=[];let browser;
try{
 await expect.poll(async()=>{try{return (await fetch(`http://127.0.0.1:${port}`)).ok}catch{return false}},{timeout:20000}).toBe(true);
 browser=await chromium.launch({headless:true});
 // Fictional attachment, not an app UI mockup. Its pixels are shown inside actual material previews.
 const sample=await browser.newPage({viewport:{width:640,height:400}});
 await sample.setContent('<style>body{margin:0;font:16px system-ui;background:#edf2f8;color:#203047}aside{position:absolute;inset:0 auto 0 0;width:140px;background:#203047;color:white;padding:28px;box-sizing:border-box}main{margin:35px 30px 0 165px;background:white;padding:28px;border-radius:14px}h1{font-size:24px;margin:10px 0 20px}label{display:block;font-size:13px;margin-top:14px}input{box-sizing:border-box;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px}button{margin-top:20px;padding:10px 30px;background:#3468b7;color:white;border:0;border-radius:6px}small{color:#68758d}</style><aside>Example app<br><br>Home<br><br>Projects<br><br>Settings</aside><main><small>DEMO ATTACHMENT</small><h1>Sign in</h1><label>Email<input value="demo@example.com"></label><label>Password<input value="••••••••"></label><button>Sign in</button></main>');
 const image='data:image/png;base64,'+(await sample.screenshot()).toString('base64');
 const videoBytes=await sample.evaluate(async image=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;document.body.replaceChildren(canvas);const ctx=canvas.getContext('2d'),img=new Image();img.src=image;await img.decode();ctx.drawImage(img,0,0);
  const stream=canvas.captureStream(15),chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
  await new Promise(resolve=>{const start=performance.now();function frame(now){const progress=Math.min(1,(now-start)/1600);ctx.drawImage(img,0,0);ctx.fillStyle='#3468b7';ctx.fillRect(0,392,640*progress,8);if(progress<1)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
 },image);await sample.close();
 const video='data:video/webm;base64,'+Buffer.from(videoBytes).toString('base64');
 for(const language of ['en','zh-TW']){
  const en=language==='en',t=key=>translate(key,language),files=Object.fromEntries(roles.map(role=>[role.id,getRoleDefaults(role.id,language)]));
  const context=await browser.newContext({viewport:{width:1560,height:1000},locale:en?'en-US':'zh-TW',timezoneId:'Asia/Taipei'});
  await context.addInitScript({content:`localStorage.setItem('quicksay.language',${JSON.stringify(language)});localStorage.setItem('quicksay.appearance',JSON.stringify({version:2,theme:'dark',transparency:35}));localStorage.setItem('qa.disk',${JSON.stringify(JSON.stringify({role:'personal',files,defaultRole:'personal',autostart:true,shortcut:{modifier:'alt',key:'H'}}))});(${installBridge.toString()})();`});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(`${language}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${language}: ${m.text()}`)});
  await page.goto(`http://127.0.0.1:${port}`);await expect(page.getByRole('textbox',{name:t('短句名稱'),exact:true})).toHaveValue(files.personal[0].name);
  await page.evaluate(({image,video,en,videoSize})=>{
   const invoke=window.__TAURI_INTERNALS__.invoke;window.__TAURI_INTERNALS__.invoke=(cmd,args)=>cmd==='storage_info'?Promise.resolve({path:'C:\\Users\\Demo\\AppData\\Roaming\\dev.quicksay.desktop\\snippets.json',backup:'C:\\Users\\Demo\\AppData\\Roaming\\dev.quicksay.desktop\\snippets.json.bak',exists:true}):invoke(cmd,args);
   qa.state.captureHotkeys={supported:true,registered:true,error:null,config:{region:'Ctrl+Shift+F6',fullscreen:'Ctrl+Shift+F7',window:'Ctrl+Shift+F8',video:'Ctrl+Shift+F9',gif:'Ctrl+Shift+F10',text:'Ctrl+Shift+F11',file:'Ctrl+Shift+F12'}};
   qa.state.materials={items:[{id:'task',kind:'text',name:'Task',text:en?'Fix the sign-in flow\nUse screenshot #02 and recording #03 to reproduce the issue. Verify the fix and report the results.':'修正登入流程\n參考截圖 #02 與錄影 #03 重現問題，修正後實測並回報結果。',size:0},{id:'screen',kind:'image',name:en?'sign-in.png':'登入畫面.png',text:'',size:14000},{id:'clip',kind:'file',name:en?'sign-in-flow.webm':'登入流程.webm',text:'',size:videoSize},{id:'spec',kind:'file',name:en?'requirements.md':'需求說明.md',text:'',size:2048}]};
   qa.mediaPreviews={screen:image,clip:video};qa.materialInfo=Object.fromEntries(['screen','clip','spec'].map(id=>[id,{created_ms:1793412000000,size:qa.state.materials.items.find(i=>i.id===id).size}]));
  },{image,video,en,videoSize:videoBytes.length});
  async function shot(name){await page.evaluate(()=>document.fonts.ready);const file=`${output}/${name}-${language}.png`;await page.screenshot({path:file,animations:'disabled'});screenshots.push({file,language,viewport:page.viewportSize(),demoData:true});console.log(`Captured ${name} (${language})`);}
  await expect(page.getByRole('button',{name:t('刪除'),exact:true})).toBeInViewport({ratio:1});await expect(page.getByRole('button',{name:t('儲存短句'),exact:true})).toBeInViewport({ratio:1});await shot('manager');
  await page.getByRole('button',{name:t('本次 prompt 素材'),exact:true}).click();await page.getByRole('button',{name:t('預覽素材')+' 3',exact:true}).click();
  const media=page.getByLabel(t('選取素材')+' '+(en?'sign-in-flow.webm':'登入流程.webm'),{exact:true});await expect.poll(()=>media.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);await media.evaluate(v=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=.5}));await shot('materials');
  await page.getByText(t('截圖快捷鍵與選項'),{exact:true}).click();await expect(page.getByRole('textbox',{name:t('新增文字'),exact:true})).toBeVisible();await shot('capture-settings');
  await page.getByRole('button',{name:t('設定'),exact:true}).click();await expect(page.getByRole('combobox',{name:t('介面語言'),exact:true})).toBeVisible();await shot('settings');
  await page.getByRole('button',{name:t('AI 教學'),exact:true}).click();await expect(page.getByRole('combobox',{name:t('範本庫'),exact:true})).toBeVisible();await page.evaluate(()=>document.querySelector('.settings-panel').scrollTop=0);await shot('ai-guide');
  const json=page.getByRole('textbox',{name:t('AI 回傳的短句 JSON'),exact:true});await json.fill(JSON.stringify([{name:en?'Verify before reporting':'驗證後再回報',text:en?'Test the main flow and report what passed, failed and remains unverified.':'實際測試主要流程，回報通過、失敗與尚未驗證的項目。',scenario:en?'When implementation is ready for verification.':'實作完成、需要驗證結果時。'}],null,2));await json.scrollIntoViewIfNeeded();await shot('ai-json');
  for(const role of ['personal','project','developer','marketing']){
   await page.setViewportSize({width:580,height:480});await page.goto(`http://127.0.0.1:${port}/?picker`);await expect(page.getByText(t('快捷提示詞'),{exact:true})).toBeVisible();await page.evaluate(({role,items})=>qa.emit('picker-state',{role,items,selected:0,visible:true}),{role,items:files[role]});await expect(page.getByText(files[role][0].name,{exact:true})).toBeVisible();await shot(`picker-${role}`);
  }
  await context.close();
 }
 expect(errors,'Screenshots must have zero console/page errors').toEqual([]);writeFileSync(`${output}/capture-manifest.json`,JSON.stringify({source:'Current frontend, isolated browser IPC and fictional demo attachments; no native app connection.',sourceCommit:process.env.README_CAPTURE_COMMIT??null,screenshots,errors},null,2));console.log(`Captured ${screenshots.length} screenshots in both languages; zero console/page errors.`);
}finally{await browser?.close();server.kill();}
