import {test,expect,Manager} from './fixture.js';
test('save and delete stay in their bottom area while long editor content scrolls',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('保留完整草稿\n'.repeat(100));await m.scenario.fill('很長的情境說明。'.repeat(60));
 for(const [width,height]of [[780,680],[940,820],[1280,860]]){
  await page.setViewportSize({width,height});await m.text.focus();await page.keyboard.press('Control+End');await expect(m.save).toBeInViewport({ratio:1});const remove=page.getByRole('button',{name:'刪除',exact:true});await expect(remove).toBeInViewport({ratio:1});await m.save.click({trial:true});await remove.click();await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await expect(m.text).toHaveValue('保留完整草稿\n'.repeat(100));await page.screenshot({path:`artifacts/editor-bottom-area/${width}.png`});
 }
 expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});
