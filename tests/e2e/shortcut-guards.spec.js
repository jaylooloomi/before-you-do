import {test,expect,Manager} from './fixture.js';
async function open(page){await new Manager(page).open();await page.getByRole('button',{name:'快捷鍵',exact:true}).click();}
test('cleared bindings can re-record native registered combinations; duplicates are blocked before IPC',async({page})=>{
 await open(page);const text=page.getByRole('textbox',{name:'新增文字',exact:true}),file=page.getByRole('textbox',{name:'新增檔案',exact:true}),save=page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last();
 await text.focus();await text.press('Backspace');await expect(text).toHaveAttribute('placeholder','未設定（停用），點此按組合鍵');await page.evaluate(()=>qa.emit('capture-shortcut-recorded','Ctrl+Shift+F11'));await expect(text).toHaveValue('Ctrl+Shift+F11');
 await text.press('Alt+l');await file.focus();await file.press('Alt+l');await expect(text).toHaveAttribute('aria-invalid','true');await expect(file).toHaveAttribute('aria-invalid','true');await expect(save).toBeDisabled();expect(await page.evaluate(()=>qa.count('capture_hotkeys_save'))).toBe(0);
 await file.press('Alt+p');await expect(file).toHaveAttribute('aria-invalid','false');await expect(save).toBeEnabled();await save.click();await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeys.config.file)).toBe('Alt+P');
});
test('disable requires confirmation; cancelling and restoring keep existing keys',async({page})=>{
 await open(page);const region=page.getByRole('textbox',{name:'區域截圖',exact:true});await region.focus();await region.press('Delete');await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last().click();await expect(page.getByRole('dialog',{name:'停用這些快捷鍵？',exact:true})).toBeVisible();await page.getByRole('button',{name:'取消',exact:true}).click();expect(await page.evaluate(()=>qa.count('capture_hotkeys_save'))).toBe(0);
 await page.getByRole('button',{name:'還原 區域截圖',exact:true}).click();await expect(region).toHaveValue('Shift+PrintScreen');await region.press('Delete');await region.press('Alt+j');await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last().click();await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeys.config.region)).toBe('Alt+J');
});
test('snippet shortcut stays visible while recording conflicting Alt+H; invalid keys receive feedback',async({page})=>{
 await open(page);const region=page.getByRole('textbox',{name:'區域截圖',exact:true});await region.focus();await region.press('Alt+h');await expect(page.getByRole('heading',{name:'快捷鍵',exact:true})).toBeVisible();await expect(region).toHaveValue('Alt+H');await expect(region).toHaveAttribute('aria-invalid','true');expect(await page.evaluate(()=>qa.count('dismiss_manager_shortcut'))).toBe(0);await region.press('Alt+j');await region.press('j');await expect(page.getByText('請按 Ctrl 或 Alt 搭配字母／數字，或使用 PrintScreen、F6–F12。',{exact:true})).toBeVisible();
});
