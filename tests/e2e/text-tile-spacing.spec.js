import {test,expect,Manager} from './fixture.js';
test('focused text card keeps number/header and menu outside the editor in both themes',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('短句草稿保留');await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.getByRole('button',{name:'加入文字',exact:true}).click();const input=page.getByRole('textbox',{name:'任務文字 1',exact:true});await input.fill('這是素材文字草稿，不可被遮住。');
 for(const [width,height]of [[940,820],[1280,860]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});await input.focus();await expect(input).toBeFocused();
  const nodes={badge:await page.getByRole('listitem',{name:'01 · 任務文字',exact:true}).getByText('#01',{exact:true}).elementHandle(),header:await page.getByRole('button',{name:'預覽素材 1',exact:true}).elementHandle(),field:await input.elementHandle(),menu:await page.getByRole('button',{name:'素材選單 1',exact:true}).elementHandle()};
  await expect.poll(()=>page.evaluate(({badge,header,field,menu})=>{const b=badge.getBoundingClientRect(),h=header.getBoundingClientRect(),f=field.getBoundingClientRect(),m=menu.getBoundingClientRect();return {headerClear:f.top-Math.max(b.bottom,h.bottom)>=8,menuClear:m.top>=f.bottom};},nodes)).toEqual({headerClear:true,menuClear:true});await expect(input).toHaveValue('這是素材文字草稿，不可被遮住。');await page.screenshot({path:`artifacts/text-tile-spacing-${width}-${theme}.png`,animations:'disabled'});
 }
 await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('短句草稿保留');expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});
