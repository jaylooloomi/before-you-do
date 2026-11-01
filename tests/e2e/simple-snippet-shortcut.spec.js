import {test,expect,Manager} from './fixture.js';
test('snippet shortcut uses a simple recordable row, validates input and restores the default',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('Keep my draft');await page.getByRole('button',{name:'快捷鍵',exact:true}).click();
 const input=page.getByRole('textbox',{name:'常用短句快捷鍵',exact:true}),save=page.getByRole('button',{name:'儲存快捷鍵',exact:true}).first();await expect(input).toHaveValue('Alt+H');await expect(page.getByRole('combobox',{name:'組合鍵',exact:true})).toHaveCount(0);await expect(page.getByRole('combobox',{name:'按鍵',exact:true})).toHaveCount(0);
 const label=await input.evaluate(i=>{const l=i.labels[0];return {height:l.getBoundingClientRect().height,font:getComputedStyle(l).fontSize,icon:!!l.querySelector('svg')};});const capture=await page.getByRole('button',{name:'執行 區域截圖',exact:true}).evaluate(b=>({height:b.getBoundingClientRect().height,font:getComputedStyle(b).fontSize}));expect(label.icon).toBe(true);expect(label.height).toBe(capture.height);expect(label.font).toBe(capture.font);await page.screenshot({path:'artifacts/shortcut-style-alignment.png'});
 await input.focus();await input.press('Alt+n');await save.click();await expect.poll(()=>page.evaluate(()=>qa.state.shortcut)).toEqual({modifier:'alt',key:'N'});
 await input.focus();await input.press('Control+Alt+j');await expect(input).toHaveAttribute('aria-invalid','true');await expect(save).toBeDisabled();await input.press('Control+Shift+Space');await expect(save).toBeEnabled();await save.click();await expect.poll(()=>page.evaluate(()=>qa.state.shortcut)).toEqual({modifier:'ctrlShift',key:'Space'});
 await page.getByRole('button',{name:'恢復 Alt+H',exact:true}).click();await expect(input).toHaveValue('Alt+H');await m.back();await expect(m.text).toHaveValue('Keep my draft');
});

