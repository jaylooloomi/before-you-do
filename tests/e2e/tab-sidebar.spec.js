import {test,expect,Manager} from './fixture.js';
test('materials and settings use full width without sidebar; library restores its draft',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('切頁仍保留草稿');const copy=page.getByRole('button',{name:'複製短句 1',exact:true});await expect(copy).toBeVisible();
 for(const width of [940,1280,1920]){
  await page.setViewportSize({width,height:860});await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(copy).toBeHidden();
  const left=await page.getByRole('region',{name:'本次素材',exact:true}).boundingBox();expect(left.x).toBeLessThan(2);expect(left.width/width).toBeCloseTo(7/25,2);await expect(page.getByRole('button',{name:'匯出素材包',exact:true})).toBeInViewport();
  await page.getByRole('button',{name:'設定與 AI 教學',exact:true}).click();await expect(copy).toBeHidden();const heading=await page.getByRole('heading',{name:'設定與 AI 教學',exact:true}).boundingBox();expect(heading.x).toBeLessThan(60);
  await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(copy).toBeVisible();await expect(m.text).toHaveValue('切頁仍保留草稿');
 }
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.screenshot({path:'artifacts/materials-without-sidebar.png',animations:'disabled'});await page.getByRole('button',{name:'設定與 AI 教學',exact:true}).click();await page.screenshot({path:'artifacts/settings-without-sidebar.png',animations:'disabled'});
 expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});
