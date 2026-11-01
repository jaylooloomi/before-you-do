import {test,expect,Manager} from './fixture.js';
import {translate} from '../../src/i18n.js';
test('material heading has no shortcut hint region; actions and settings remain available in four languages',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('保留短句草稿');await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 for(const language of ['zh-TW','zh-CN','en','ja']){await page.evaluate(async language=>(await import('/src/i18n.js')).setLanguage(language),language);await expect(page.getByRole('group',{name:translate('快捷鍵',language),exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:translate('區域截圖',language),exact:true})).toBeVisible();}
 await page.evaluate(async()=>(await import('/src/i18n.js')).setLanguage('zh-TW'));await page.getByRole('button',{name:'快捷鍵',exact:true}).click();await expect(page.getByRole('textbox',{name:'區域截圖',exact:true})).toBeVisible();await m.back();await expect(m.text).toHaveValue('保留短句草稿');expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});
