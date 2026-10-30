import {readFileSync} from 'node:fs';import {test,expect,Manager} from './fixture.js';
const video='data:video/webm;base64,'+readFileSync(new URL('../fixtures/material-video.webm',import.meta.url)).toString('base64');
async function open(page){await page.setViewportSize({width:1280,height:879});const m=new Manager(page);await m.open();await page.evaluate(video=>{window.qa.state.materials={items:[{id:'task',name:'Text',kind:'text',text:'修正登入流程\n請檢查登入錯誤，修正並實際測試主要流程。',size:0},{id:'image',name:'login.png',kind:'image',text:'',size:1024},{id:'clip',name:'登入流程.webm',kind:'file',text:'',size:53255},{id:'pdf',name:'需求說明.pdf',kind:'file',text:'',size:254000}]};window.qa.mediaPreviews={clip:video};window.qa.materialInfo={clip:{size:53255,created_ms:Date.UTC(2024,5,14,6,20)}};},video);await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();return m;}
test('reference geometry, compact tools, detail rows and real custom shortcut labels',async({page})=>{
 await open(page);await page.getByRole('button',{name:'預覽素材 3',exact:true}).click();await expect.poll(()=>page.getByLabel('選取素材 登入流程.webm',{exact:true}).evaluate(v=>v.videoWidth)).toBe(128);
 const heading=await page.getByRole('heading',{name:'素材預覽',exact:true}).boundingBox();expect(heading.x).toBeGreaterThan(360);expect(heading.x).toBeLessThan(390);
 const buttons=['區域截圖','全螢幕截圖','目前視窗截圖','錄製影片','錄製 GIF','加入文字','加入檔案'];const boxes=[];for(const name of buttons){const b=page.getByRole('button',{name,exact:true});await expect(b).toBeInViewport({ratio:1});boxes.push(await b.boundingBox());}expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(160);
 for(const key of ['類型','大小','時長','建立時間','尺寸'])await expect(page.getByText(key,{exact:true})).toBeVisible();await expect(page.getByText('128 × 72',{exact:true})).toBeVisible();await expect(page.getByText('00:02',{exact:true})).toBeVisible();await expect(page.getByText(/2024/)).toBeVisible();
 await page.evaluate(()=>window.qa.emit('capture-hotkeys-changed',{supported:true,registered:true,error:null,config:{...window.qa.state.captureHotkeys.config,video:'Ctrl+Shift+F9'}}));await expect(page.getByText('Ctrl+Shift+F9',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'最大化／還原',exact:true}).click();expect(await page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='window_action').at(-1).args.action)).toBe('maximize');await page.screenshot({path:'artifacts/reference-layout-1280.png'});
});
test('overflow sorting, stale metadata, missing preview and media disposal retain user data',async({page})=>{
 const m=await open(page);await page.getByRole('button',{name:'預覽素材 3',exact:true}).click();const selected=page.getByLabel('選取素材 登入流程.webm',{exact:true});await expect.poll(()=>selected.evaluate(v=>v.readyState)).toBeGreaterThan(0);const old=await selected.elementHandle();await selected.evaluate(async v=>{v.muted=true;await v.play();});await page.getByRole('button',{name:'預覽素材 1',exact:true}).click();await expect.poll(()=>old.evaluate(v=>v.paused)).toBe(true);
 await page.getByRole('button',{name:'素材選單 4',exact:true}).click();await page.getByRole('button',{name:'上移素材 4',exact:true}).click();await expect(page.getByRole('listitem',{name:'03 · 需求說明.pdf',exact:true})).toBeVisible();await page.getByRole('button',{name:'移除素材 3',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.qa.state.materials.items.length)).toBe(3);
 await page.evaluate(()=>window.qa.hold('materials_info'));await page.getByRole('button',{name:'預覽素材 2',exact:true}).click();await page.getByRole('button',{name:'預覽素材 1',exact:true}).click();await page.evaluate(()=>window.qa.release('materials_info'));await expect(page.getByText('修正登入流程\n請檢查登入錯誤，修正並實際測試主要流程。',{exact:true}).filter({visible:true})).toBeVisible();
 await page.getByRole('textbox',{name:'任務文字 1',exact:true}).fill('保留我的素材草稿');await page.keyboard.press('Control+s');await expect.poll(()=>page.evaluate(()=>window.qa.state.materials.items[0].text)).toBe('保留我的素材草稿');expect(await page.evaluate(()=>window.qa.count('save_snippets'))).toBe(0);await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('先整理需求再進行。');
});


test('left panel is enlarged 1.2 times from the previous width at every desktop breakpoint',async({page})=>{
 await open(page);
 for(const [width,height]of [[940,820],[1280,879],[1920,1080]]){
  await page.setViewportSize({width,height});
  const panel=page.getByRole('complementary').filter({has:page.getByRole('heading',{name:'素材預覽',exact:true})});
  const box=await panel.boundingBox();const left=await page.getByRole('region',{name:'本次素材',exact:true}).boundingBox();expect(box.width/left.width).toBeCloseTo(18/7,2);
  const exp=page.getByRole('button',{name:'匯出素材包',exact:true});await expect(exp).toBeInViewport({ratio:1});await exp.click({trial:true});
  const copy=page.getByRole('button',{name:'複製整合文字',exact:true});await expect(copy).toBeInViewport({ratio:1});
  await page.screenshot({path:`artifacts/ratio-panel-${width}.png`,animations:'disabled'});
 }
});
