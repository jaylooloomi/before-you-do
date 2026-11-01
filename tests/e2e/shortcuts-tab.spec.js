import {test,expect,Manager} from './fixture.js';
test.setTimeout(90000);
test('dedicated shortcut tab owns all settings and switching tabs preserves drafts',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('Preserve original draft');
 const nav=page.getByRole('navigation',{name:'頁面導覽',exact:true});await expect(nav.getByRole('button')).toHaveCount(5);
 await page.getByRole('button',{name:'快捷鍵',exact:true}).click();await expect(page.getByRole('heading',{name:'快捷鍵',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'常用短句快捷鍵',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'執行 區域截圖',exact:true})).toBeEnabled();
 for(const name of ['區域截圖','全螢幕截圖','目前視窗截圖','錄製影片','錄製 GIF','新增文字','新增檔案','貼上全部素材'])await expect(page.getByRole('textbox',{name,exact:true})).toBeVisible();
 const region=page.getByRole('textbox',{name:'區域截圖',exact:true});await region.focus();await region.press('Alt+j');await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last().click();await expect.poll(()=>page.evaluate(()=>qa.state.captureHotkeys.config.region)).toBe('Alt+J');
 await page.getByRole('textbox',{name:'常用短句快捷鍵',exact:true}).press('Alt+n');await page.getByRole('button',{name:'儲存快捷鍵',exact:true}).first().click();await expect.poll(()=>page.evaluate(()=>qa.state.shortcut.key)).toBe('N');
 await m.settings();await expect(region).toBeHidden();await expect(page.getByRole('textbox',{name:'常用短句快捷鍵',exact:true})).toBeHidden();await expect(page.getByRole('combobox',{name:'介面語言',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('checkbox',{name:'像素放大鏡',exact:true})).toBeVisible();await expect(region).toBeHidden();await expect(page.getByRole('button',{name:'儲存快捷鍵',exact:true}).last()).toBeHidden();
 await m.back();await expect(m.text).toHaveValue('Preserve original draft');await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'快捷鍵',exact:true}).click();await expect(region).toHaveValue('Alt+J');await expect(page.getByRole('textbox',{name:'常用短句快捷鍵',exact:true})).toHaveValue('Alt+N');
});
test('shortcuts page is reachable and localized at minimum desktop width',async({page})=>{
 const m=new Manager(page);await m.open();await page.setViewportSize({width:780,height:680});await page.getByRole('button',{name:'快捷鍵',exact:true}).click();
 for(const [lang,label,region]of [['en','Shortcut','Capture region'],['ja','ショートカット','範囲を撮影'],['zh-CN','快捷键','区域截图'],['zh-TW','快捷鍵','區域截圖']]){
  await page.getByRole('combobox',{name:/顯示語言|显示语言|Display language|クイック言語切替/}).selectOption(lang);await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();const field=page.getByRole('textbox',{name:region,exact:true});await field.scrollIntoViewIfNeeded();await expect(field).toBeInViewport();await field.click({trial:true});
 }
});

