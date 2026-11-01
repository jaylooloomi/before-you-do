import {test,expect,Manager} from './fixture.js';
test('tray navigation opens clipboard and snippets while retaining the snippet draft',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('Tray navigation draft');
 await page.evaluate(()=>qa.emit('tray-navigate','materials'));
 await expect(page.getByRole('button',{name:'本次 prompt 素材',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>qa.emit('tray-navigate','snippets'));
 await expect(m.text).toBeVisible();await expect(m.text).toHaveValue('Tray navigation draft');
 expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});
