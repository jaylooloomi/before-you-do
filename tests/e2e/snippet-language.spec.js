import {test,expect,Manager} from './fixture.js';
import {getRoleDefaults,getRoleTranslations} from '../../src/roles.js';
import {translate} from '../../src/i18n.js';
async function language(page,value){await page.evaluate(async value=>{const i18n=await import('/src/i18n.js');i18n.setLanguage(value);},value);await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe(value);}
async function seeded(page){await page.goto('/');await expect(new Manager(page).name).toBeVisible();const files={personal:[getRoleTranslations('personal','zh-TW')[0],...getRoleDefaults('personal','zh-TW').slice(1),{name:'我的自訂',text:'不准改我的內容',scenario:'我的情境'}]};await page.evaluate(files=>{qa.state.files=files;localStorage.setItem('qa.disk',JSON.stringify(qa.state));},files);await page.reload();}
test('language switches built-in names and bodies while preserving raw files and custom entries',async({page})=>{
 await seeded(page);const m=new Manager(page);const disk=await page.evaluate(()=>JSON.stringify(qa.state.files));
 for(const locale of ['en','ja','zh-CN','zh-TW']){
  await language(page,locale);const expected=getRoleDefaults('personal',locale)[0];
  await expect(page.getByRole('textbox',{name:translate('短句名稱',locale),exact:true})).toHaveValue(expected.name);
  await expect(page.getByRole('textbox',{name:translate('短句內容',locale),exact:true})).toHaveValue(expected.text);
  await expect.poll(()=>page.evaluate(()=>JSON.stringify(qa.state.files))).toBe(disk);
  await expect(page.getByRole('button',{name:/我的自訂 不准改我的內容/})).toBeVisible();
 }
});
test('unsaved edits and newly added copies never change when switching languages',async({page})=>{
 await seeded(page);const m=new Manager(page);await m.text.fill('尚未儲存的修改');await m.scenario.fill('自訂用途');
 await language(page,'en');await expect(page.getByRole('textbox',{name:'Snippet text',exact:true})).toHaveValue('尚未儲存的修改');
 await language(page,'zh-TW');await expect(m.scenario).toHaveValue('自訂用途');
 await page.getByRole('button',{name:'新增短句',exact:true}).click();const original=getRoleDefaults('personal','zh-TW')[0];await m.name.fill(original.name);await m.text.fill(original.text);await m.save.click();
 await language(page,'en');await expect(page.getByRole('textbox',{name:'Snippet name',exact:true})).toHaveValue(original.name);
 await expect(page.getByRole('textbox',{name:'Snippet text',exact:true})).toHaveValue(original.text);
 await page.reload();await expect.poll(()=>page.evaluate(()=>qa.state.files.personal.at(-1).scenario)).toBe('');
});
test('picker renders translated built-ins but leaves custom prompts unchanged',async({page})=>{
 await seeded(page);await language(page,'en');await page.goto('/?picker');await expect(page.getByText(getRoleDefaults('personal','en')[0].name,{exact:true})).toBeVisible();await expect(page.getByText('我的自訂',{exact:true})).toBeVisible();
});
