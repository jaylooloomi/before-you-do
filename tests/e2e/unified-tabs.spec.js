import {test,expect,Manager} from './fixture.js';
test('four tabs share a readable visual system in light and dark without losing drafts',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('四個分頁共用樣式，保留這份草稿');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  for(const [name,key]of [['常用短句','library'],['本次 prompt 素材','materials'],['設定','settings'],['AI 教學','ai']]){
   await page.getByRole('button',{name,exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.querySelector('.app-shell').dataset.page)).toBe(key);
   const heading=page.getByRole('heading',{name:key==='library'?'把常說的話，留在手邊。':name,exact:true});await expect(heading).toBeVisible();
   for(const width of [940,1280]){await page.setViewportSize({width,height:860});await expect(heading).toBeInViewport();await page.screenshot({path:`artifacts/unified-tabs/${key}-${theme}-${width}.png`});}
  }
 }
 await m.back();await expect(m.text).toHaveValue('四個分頁共用樣式，保留這份草稿');expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});


