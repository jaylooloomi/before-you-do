import {test,expect,Manager} from './fixture.js';
import {translate} from '../../src/i18n.js';
test('autostart switches persist across reload, translate in four languages, and preserve snippets',async({page})=>{
 const m=new Manager(page);await m.open();await m.settings();const files=await page.evaluate(()=>JSON.stringify(qa.state.files));
 for(const locale of ['zh-TW','zh-CN','en','ja']){
  await page.evaluate(async locale=>(await import('/src/i18n.js')).setLanguage(locale),locale);
  const toggle=page.getByRole('checkbox',{name:translate('登入電腦後自動啟動',locale)});
  await expect(toggle).toBeEnabled();await toggle.check();await expect(toggle).toBeEnabled();
  await expect(page.getByText(translate('已啟用登入時自動啟動。',locale),{exact:true})).toBeVisible();
  await toggle.uncheck();await expect(toggle).toBeEnabled();
 }
 await page.evaluate(async()=>(await import('/src/i18n.js')).setLanguage('zh-TW'));
 const toggle=page.getByRole('checkbox',{name:'登入電腦後自動啟動'});await toggle.check();await expect(toggle).toBeEnabled();
 await page.reload();await m.settings();await expect(toggle).toBeChecked();await toggle.uncheck();await expect(toggle).toBeEnabled();
 expect(await page.evaluate(()=>JSON.stringify(qa.state.files))).toBe(files);
});
test('startup read and write errors are visible without corrupting state',async({page})=>{
 const m=new Manager(page);await m.open();await page.evaluate(()=>qa.failures.get_autostart='error.read');await m.settings();
 const toggle=page.getByRole('checkbox',{name:'登入電腦後自動啟動'});await expect(toggle).toBeDisabled();await expect(page.getByText(/無法讀取啟動設定/)).toBeVisible();
 await page.evaluate(()=>delete qa.failures.get_autostart);await m.back();await m.settings();await expect(toggle).toBeEnabled();
 await page.evaluate(()=>qa.failures.set_autostart='error.read');await toggle.click();await expect(toggle).toBeEnabled();await expect(toggle).not.toBeChecked();await expect(page.getByText(/未能更新啟動設定/)).toBeVisible();
});
