import {test,expect,Manager} from './fixture.js';
test('library sidebar matches material collection width across desktop sizes and preserves drafts',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('切換分頁後保留我的草稿');
 for(const width of [940,1280,1920]){
  await page.setViewportSize({width,height:860});
  const sidebar=page.getByRole('complementary').filter({has:page.getByRole('button',{name:'複製短句 1',exact:true})});const box=await sidebar.boundingBox();expect(box.width/width).toBeCloseTo(7/25,2);await m.save.click({trial:true});
  if(width===1280)await page.screenshot({path:'artifacts/aligned-library-panel.png',animations:'disabled'});
  await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();const collection=await page.getByRole('region',{name:'本次素材',exact:true}).boundingBox();expect(collection.width).toBeCloseTo(box.width,1);
  if(width===1280)await page.screenshot({path:'artifacts/aligned-material-panel.png',animations:'disabled'});
  await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('切換分頁後保留我的草稿');
 }
 expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});
