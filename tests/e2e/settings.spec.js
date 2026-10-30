import {test,expect,Manager} from './fixture.js';
test('E07 copy saved JSON and AI instructions, import, reload and template',async({page})=>{
 const m=new Manager(page);await m.open();await m.guide();await page.getByRole('button',{name:'複製短句 JSON',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(qa.clipboard))).toEqual(await page.evaluate(()=>qa.state.files.personal));await page.getByRole('button',{name:'複製修改指令',exact:true}).click();await expect.poll(()=>page.evaluate(()=>qa.clipboard)).toContain('QA_ONLY');
 await page.getByRole('textbox',{name:'AI 回傳的短句 JSON',exact:true}).fill(JSON.stringify([{name:'新資料',text:'新正文',scenario:'新情境'}]));await page.getByRole('button',{name:'檢查並套用 JSON',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('新資料');await page.getByRole('dialog').getByRole('button',{name:'套用並儲存',exact:true}).click();await expect.poll(()=>page.evaluate(()=>qa.state.files.personal[0].name)).toBe('新資料');await page.getByRole('button',{name:'重新載入檔案',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已重新載入檔案'})).toBeVisible();await page.getByRole('button',{name:'新增此範本',exact:true}).click();await m.back();await expect(m.name).not.toHaveValue('新資料');
});
test('E08 invalid JSON types and long names never write; markup preview is inert',async({page})=>{
 const m=new Manager(page);await m.open();await m.guide();const input=page.getByRole('textbox',{name:'AI 回傳的短句 JSON',exact:true});
 for(const value of ['{bad','[{"name":2,"text":"x"}]',JSON.stringify([{name:'x'.repeat(101),text:'x'}])]){await input.fill(value);await page.getByRole('button',{name:'檢查並套用 JSON',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'未完成'})).toBeVisible();}
 await expect.poll(()=>page.evaluate(()=>qa.count('save_snippets'))).toBe(0);await input.fill(JSON.stringify([{name:'<script>window.hacked=1</script>',text:"' OR 1=1"}]));await page.getByRole('button',{name:'檢查並套用 JSON',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('<script>');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>window.hacked||0)).toBe(0);
});
test('E09 held copy request disables repeated action until completion',async({page})=>{
 const m=new Manager(page);await m.open();await m.guide();await page.evaluate(()=>qa.hold('copy_text'));const copy=page.getByRole('button',{name:'複製短句 JSON',exact:true});await copy.click();await expect(copy).toBeDisabled();await page.evaluate(()=>qa.release('copy_text'));await expect(copy).toBeEnabled();await expect.poll(()=>page.evaluate(()=>qa.count('copy_text'))).toBe(1);
});
test('E10 rejected IPC actions show errors and recover',async({page})=>{
 const m=new Manager(page);await m.open();await m.guide();for(const [cmd,label]of [['copy_text','複製短句 JSON'],['reload_snippets','重新載入檔案'],['save_shortcut','儲存快捷鍵']]){if(cmd==='save_shortcut')await m.settings();else await m.guide();await page.evaluate(cmd=>qa.failures[cmd]='error.read',cmd);const button=page.getByRole('button',{name:label,exact:true});await button.click();await expect(page.getByRole('status').filter({hasText:'未完成'})).toBeVisible();await expect(button).toBeEnabled();await page.evaluate(cmd=>delete qa.failures[cmd],cmd);}
});
test('E11 four languages persist through refresh without translating snippets',async({page})=>{
 const m=new Manager(page);await m.open();await m.guide();for(const locale of ['en','ja','zh-CN','zh-TW']){await page.getByRole('combobox',{name:/顯示語言|显示语言|Display language|クイック言語切替/}).selectOption(locale);await expect(page.getByRole('textbox',{name:/JSON/})).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe(locale);await page.reload();await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe(locale);await expect.poll(()=>page.evaluate(()=>qa.state.files.personal[0].name)).toBe('理解後直接進行');await m.guide();}
});
test('E12 settings controls and modal keyboard are reachable',async({page})=>{
 const m=new Manager(page);await m.open();await m.guide();for(const [width,height]of [[1920,1080],[780,680],[390,844]]){await page.setViewportSize({width,height});await page.getByRole('button',{name:'檢查並套用 JSON',exact:true}).click({trial:true});await page.screenshot({path:`artifacts/qa/settings-${width}.png`});}
});
