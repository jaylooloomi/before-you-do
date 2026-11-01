import {test,expect,Manager} from './fixture.js';
test('first tab aligns with the sidebar right edge across window sizes',async({page})=>{
 await new Manager(page).open();
 for(const width of [780,850,851,940,1150,1280,1920]){
  await page.setViewportSize({width,height:860});
  const sidebar=page.getByRole('complementary').filter({has:page.getByRole('heading',{name:'短句資料庫',exact:true})});
  const panel=await sidebar.boundingBox(),tab=await page.getByRole('button',{name:'常用短句',exact:true}).boundingBox();
  expect(Math.abs(tab.x-panel.x-panel.width)).toBeLessThan(1);
  await page.getByRole('button',{name:'收起到系統匣',exact:true}).click({trial:true});
 }
 await page.screenshot({path:'artifacts/tab-panel-alignment.png',animations:'disabled'});
});
