import {test,expect} from './fixture.js';
async function open(page){await page.goto('/');await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('button',{name:'錄製影片',exact:true})).toBeEnabled();}
test('workspace owns options and independent capture shortcuts',async({page})=>{
 await open(page);await page.getByText('截圖快捷鍵與選項',{exact:true}).click();
 await expect(page.getByRole('textbox',{name:'區域截圖',exact:true})).toHaveValue('Shift+PrintScreen');
 await page.getByRole('textbox',{name:'區域截圖',exact:true}).fill('Ctrl+F8');
 await page.getByRole('textbox',{name:'全螢幕截圖',exact:true}).fill('');
 await page.getByRole('button',{name:'儲存截圖快捷鍵',exact:true}).click();
 await expect(page.getByText('截圖快捷鍵已儲存',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.qa.state.shortcut)).toEqual({modifier:'alt',key:'H'});
 await page.getByRole('checkbox',{name:'像素放大鏡',exact:true}).uncheck();expect(await page.evaluate(()=>localStorage.getItem('before-you-do.capture.magnifier'))).toBe('false');
 await page.reload();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.getByText('截圖快捷鍵與選項',{exact:true}).click();await expect(page.getByRole('textbox',{name:'區域截圖',exact:true})).toHaveValue('Ctrl+F8');
});
test('recording chooses its own region mode and reports stop/finalization',async({page})=>{
 await open(page);await page.getByRole('button',{name:'錄製影片',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='capture_start').at(-1)?.args.mode)).toBe('record-video');
 await page.evaluate(()=>window.qa.emit('recording-state',{phase:'recording',format:'video'}));await expect(page.getByRole('button',{name:'錄製 GIF',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'停止錄影',exact:true}).click();await expect(page.getByLabel('錄影狀態')).toContainText('正在完成錄影');
 await page.evaluate(()=>window.qa.emit('recording-state',{phase:'saved',format:'video'}));await expect(page.getByLabel('錄影狀態')).toHaveText('錄影已加入素材區');await expect(page.getByRole('button',{name:'錄製 GIF',exact:true})).toBeEnabled();
});
test('runtime requires an explicit install and blocks repeat clicks',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{window.qa.state.recording={supported:true,runtime_ready:false,installing:false,status:{phase:'idle'}};window.qa.hold('recording_install');});
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('button',{name:'錄製影片',exact:true})).toBeDisabled();expect(await page.evaluate(()=>window.qa.count('recording_install'))).toBe(0);
 await page.getByRole('button',{name:'安裝錄影元件',exact:true}).click();await expect(page.getByRole('button',{name:'安裝錄影元件',exact:true})).toBeDisabled();await page.evaluate(()=>window.qa.release('recording_install'));await expect(page.getByRole('button',{name:'錄製影片',exact:true})).toBeEnabled();
});
test('shortcut conflicts preserve typed values and recording errors show recovery path',async({page})=>{
 await open(page);await page.getByText('截圖快捷鍵與選項',{exact:true}).click();await page.getByRole('textbox',{name:'區域截圖',exact:true}).fill('Ctrl+F8');await page.evaluate(()=>window.qa.failures.capture_hotkeys_save='Shortcut conflict: Ctrl+F8');await page.getByRole('button',{name:'儲存截圖快捷鍵',exact:true}).click();await expect(page.getByText('Shortcut conflict: Ctrl+F8',{exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'區域截圖',exact:true})).toHaveValue('Ctrl+F8');await page.evaluate(()=>window.qa.emit('capture-hotkeys-changed',{supported:true,registered:true,error:null,config:window.qa.state.captureHotkeys.config}));await expect(page.getByText('Shortcut conflict: Ctrl+F8',{exact:true})).toBeHidden();
 await page.evaluate(()=>window.qa.emit('recording-state',{phase:'error',error:'Disk full',recovery:'QA_ONLY/recover.webm'}));await expect(page.getByLabel('錄影狀態')).toContainText('QA_ONLY/recover.webm');
});
test('unsupported platform stays explicit and text materials keep working',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{window.qa.state.recording={supported:false,runtime_ready:false,status:{phase:'idle'}};window.qa.state.captureHotkeys={supported:false,config:{}};});await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByLabel('錄影狀態')).toContainText('Mac');await expect(page.getByRole('button',{name:'錄製影片',exact:true})).toBeDisabled();await page.getByRole('button',{name:'加入文字',exact:true}).click();await expect(page.getByRole('textbox',{name:'任務文字 1',exact:true})).toBeVisible();
});
