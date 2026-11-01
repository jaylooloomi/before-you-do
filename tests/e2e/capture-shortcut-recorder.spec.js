import {test,expect,Manager} from './fixture.js';
test('records shortcut combinations, clears and restores, saves and reloads without losing drafts',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('保留未儲存草稿');await page.evaluate(()=>{qa.state.captureHotkeys.config.file='Ctrl+Shift+F12';});
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.getByRole('button',{name:'快捷鍵',exact:true}).click();
 const region=page.getByRole('textbox',{name:'區域截圖',exact:true});await region.focus();await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeysEditing)).toBe(true);await region.press('Alt+j');await expect(region).toHaveValue('Alt+J');
 await region.press('j');await expect(region).toHaveValue('Alt+J');await region.press('Escape');await expect(region).toHaveValue('Shift+PrintScreen');
 await region.press('Alt+j');const file=page.getByRole('textbox',{name:'新增檔案',exact:true});await file.focus();await file.press('Backspace');await expect(file).toHaveValue('');
 await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last().click();await page.getByRole('button',{name:'儲存並停用',exact:true}).click();await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeys.config.region)).toBe('Alt+J');
 await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('保留未儲存草稿');
 await page.reload();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.getByRole('button',{name:'快捷鍵',exact:true}).click();await expect(region).toHaveValue('Alt+J');await expect(file).toHaveValue('');
});
test('shortcut conflict keeps the recorded draft and existing configuration until retry succeeds',async({page})=>{
 const m=new Manager(page);await m.open();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.getByRole('button',{name:'快捷鍵',exact:true}).click();
 const region=page.getByRole('textbox',{name:'區域截圖',exact:true});await region.focus();await region.press('Alt+j');
 await page.evaluate(()=>{qa.failures.capture_hotkeys_save='Shortcut conflict: Alt+J';});await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last().click();await expect(page.getByText('快捷鍵已被占用：Alt+J。請改用其他組合。',{exact:true})).toBeVisible();await expect(region).toHaveValue('Alt+J');expect(await page.evaluate(()=>qa.state.captureHotkeys.config.region)).toBe('Shift+PrintScreen');await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeysEditing)).toBe(false);
 await page.evaluate(()=>{delete qa.failures.capture_hotkeys_save;});await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last().click();await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeys.config.region)).toBe('Alt+J');
});
