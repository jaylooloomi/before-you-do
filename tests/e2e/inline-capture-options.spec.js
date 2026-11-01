import {test,expect,Manager} from './fixture.js';
test('inline capture options toggle directly and persist through tabs and reload',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('Keep original draft');await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 const auto=page.getByRole('checkbox',{name:'自動偵測',exact:true}),magnifier=page.getByRole('checkbox',{name:'像素放大鏡',exact:true});await expect(auto).toBeVisible();await expect(magnifier).toBeVisible();await auto.uncheck();await magnifier.uncheck();
 expect(await page.evaluate(()=>localStorage.getItem('before-you-do.capture.auto'))).toBe('false');expect(await page.evaluate(()=>localStorage.getItem('before-you-do.capture.magnifier'))).toBe('false');
 await m.settings();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(auto).not.toBeChecked();await expect(magnifier).not.toBeChecked();await m.back();await expect(m.text).toHaveValue('Keep original draft');
 await page.reload();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(auto).not.toBeChecked();await expect(magnifier).not.toBeChecked();await auto.check();await magnifier.check();
 expect(await page.evaluate(()=>localStorage.getItem('before-you-do.capture.auto'))).toBe('true');expect(await page.evaluate(()=>localStorage.getItem('before-you-do.capture.magnifier'))).toBe('true');
});
