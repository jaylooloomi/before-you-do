import {test,expect,Manager} from './fixture.js';
test('Alt+V is configurable and batch paste flushes pending text without touching snippet drafts',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('Keep snippet draft');await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 await page.getByRole('button',{name:'加入文字',exact:true}).click();await page.getByRole('textbox',{name:'任務文字 1',exact:true}).fill('Latest task text');
 await page.evaluate(()=>qa.emit('materials-paste-request',12345));await expect.poll(()=>page.evaluate(()=>qa.batchPaste?.items[0]?.text)).toBe('Latest task text');expect(await page.evaluate(()=>qa.batchPaste.target)).toBe(12345);
 await page.getByRole('button',{name:'快捷鍵',exact:true}).click();const binding=page.getByRole('textbox',{name:'貼上全部素材',exact:true});await expect(binding).toHaveValue('');await binding.focus();await binding.press('Control+Alt+p');await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last().click();await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeys.config.paste)).toBe('Ctrl+Alt+P');
 await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('Keep snippet draft');
});
test('failed draft flush prevents batch paste and leaves text editable',async({page})=>{
 const m=new Manager(page);await m.open();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.getByRole('button',{name:'加入文字',exact:true}).click();
 await page.evaluate(()=>{qa.failures.materials_text='disk full';});const text=page.getByRole('textbox',{name:'任務文字 1',exact:true});await text.fill('Never lose this');await page.evaluate(()=>qa.emit('materials-paste-request',12345));await expect(page.getByRole('status').filter({hasText:'disk full'})).toBeVisible();expect(await page.evaluate(()=>qa.count('materials_paste_all'))).toBe(0);await expect(text).toHaveValue('Never lose this');
});
