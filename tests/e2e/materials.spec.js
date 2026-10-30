import {test,expect,Manager} from './fixture.js';
async function open(page){const manager=new Manager(page);await manager.open();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('heading',{name:'本次 prompt 素材'})).toBeVisible();return manager;}
test('materials preserve snippet drafts; text, files, ordering, export and refresh',async({page})=>{
 const manager=new Manager(page);await manager.open();await manager.text.fill('Original unsaved snippet draft');await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 await page.getByRole('button',{name:'加入文字',exact:true}).click();const text=page.getByRole('textbox',{name:'任務文字 1',exact:true});await text.fill('<script>alert(1)</script>\n請分析這個問題');
 await page.getByText('截圖快捷鍵與選項',{exact:true}).click();await page.getByRole('button',{name:'儲存文字草稿',exact:true}).click();await page.getByText('截圖快捷鍵與選項',{exact:true}).click();await expect(page.getByRole('status').filter({hasText:'素材已儲存'})).toBeVisible();
 await page.getByLabel('選擇素材檔案',{exact:true}).setInputFiles({name:'context.txt',mimeType:'text/plain',buffer:Buffer.from('reference text')});await expect(page.getByRole('listitem',{name:'02 · context.txt',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'素材選單 2',exact:true}).click();await page.getByRole('button',{name:'上移素材 2',exact:true}).click();await expect(page.getByRole('listitem',{name:'01 · context.txt',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'複製整合文字',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.qa.clipboard)).toContain('<script>alert(1)</script>');
 await page.getByRole('button',{name:'匯出素材包',exact:true}).click();await expect(page.getByText('匯出位置：QA_ONLY/prompt-materials/exports/test-bundle',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(manager.text).toHaveValue('Original unsaved snippet draft');expect(await page.evaluate(()=>window.qa.count('save_snippets'))).toBe(0);
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('textbox',{name:'任務文字 2'})).toHaveValue('<script>alert(1)</script>\n請分析這個問題');
 await page.reload();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('textbox',{name:'任務文字 2'})).toHaveValue('<script>alert(1)</script>\n請分析這個問題');
 await page.getByRole('button',{name:'移除素材 1',exact:true}).click();await expect(page.getByRole('listitem',{name:'01 · 任務文字',exact:true})).toBeVisible();
});
test('capture commands, async guard, errors and retry keep text',async({page})=>{
 await open(page);await page.getByRole('button',{name:'加入文字',exact:true}).click();await page.getByRole('textbox',{name:'任務文字 1'}).fill('keep this');
 await page.evaluate(()=>window.qa.hold('capture_start'));const capture=page.getByRole('button',{name:'全螢幕截圖',exact:true});await capture.click();await expect(capture).toBeDisabled();await page.evaluate(()=>window.qa.release('capture_start'));await expect(page.getByRole('listitem',{name:'02 · fullscreen.png',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'目前視窗截圖',exact:true}).click();await expect(page.getByRole('listitem',{name:'03 · window.png',exact:true})).toBeVisible();await page.screenshot({path:'artifacts/prompt-material-workspace.png',fullPage:true});
 await page.evaluate(()=>window.qa.failures.capture_start='Capture unavailable');await page.getByRole('button',{name:'區域截圖',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'素材操作失敗：Capture unavailable'})).toBeVisible();await expect(page.getByRole('textbox',{name:'任務文字 1'})).toHaveValue('keep this');
 await page.evaluate(()=>delete window.qa.failures.capture_start);await page.getByRole('button',{name:'區域截圖',exact:true}).click();expect(await page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='capture_start').map(c=>c.args.mode))).toEqual(['fullscreen','window','region','region']);
});
test('save failure retains editable text and blocks leaving until retry',async({page})=>{
 await open(page);await page.getByRole('button',{name:'加入文字',exact:true}).click();await page.evaluate(()=>window.qa.failures.materials_text='Disk full');await page.getByRole('textbox',{name:'任務文字 1'}).fill('unsaved material');await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'素材操作失敗：Disk full'})).toBeVisible();await expect(page.getByRole('textbox',{name:'任務文字 1'})).toHaveValue('unsaved material');
 await page.evaluate(()=>delete window.qa.failures.materials_text);await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(page.getByRole('heading',{name:'把常說的話，留在手邊。'})).toBeVisible();
});
test('capture overlay maps drag to physical pixels and Escape cancels',async({page})=>{
 await page.goto('/?capture-region');await expect.poll(()=>page.evaluate(()=>window.qa.calls.some(c=>c.cmd==='plugin:event|listen'&&c.args.event==='capture-ready'))).toBe(true);await page.evaluate(()=>window.qa.emit('capture-ready',null));await expect(page.getByRole('img')).toHaveAttribute('src',/^data:image/);
 // Browser-only pointer events target our test page; no desktop input is generated.
 await page.mouse.move(100,100);await page.mouse.down();await page.mouse.move(300,300);await page.mouse.up();await expect.poll(()=>page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='capture_finish').length)).toBe(1);expect(await page.evaluate(()=>window.qa.calls.find(c=>c.cmd==='capture_finish').args.rect)).toEqual([204,131,409,265]);
 await page.evaluate(()=>window.qa.emit('capture-ready',null));await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='capture_finish').length)).toBe(2);expect(await page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='capture_finish').at(-1).args.rect)).toBeNull();
});

test('material workspace fits supported minimum viewport and four languages',async({page})=>{
 await page.setViewportSize({width:780,height:680});const manager=await open(page);
 await expect(page.getByRole('button',{name:'區域截圖',exact:true})).toBeInViewport();
 for(const [language,title,region]of [['en','Prompt workspace','Capture region'],['ja','今回のプロンプト素材','範囲を撮影'],['zh-CN','本次 prompt 素材','区域截图'],['zh-TW','本次 prompt 素材','區域截圖']]){
  await page.getByRole('button',{name:/^(設定|设置|Settings)$/}).click();
  await page.getByRole('combobox',{name:/介面語言|Interface language|界面语言|表示言語/}).selectOption(language);
  await page.getByRole('button',{name:/本次 prompt 素材|Prompt workspace|今回のプロンプト素材/,exact:true}).click();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.getByRole('button',{name:region,exact:true})).toBeInViewport();
 }
});

test('pending material text is recovered after immediate reload without changing snippets',async({page})=>{
 await open(page);await page.getByRole('button',{name:'加入文字',exact:true}).click();await page.getByRole('textbox',{name:'任務文字 1'}).fill('Recover before debounce');await page.reload();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('textbox',{name:'任務文字 1'})).toHaveValue('Recover before debounce');expect(await page.evaluate(()=>window.qa.count('save_snippets'))).toBe(0);
});
