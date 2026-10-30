import {test,expect,Manager} from './fixture.js';
test('all page titles match the library title origin and type at each supported width',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('標題對齊也要保留草稿');
 for(const width of [780,940,1280,1920]){
  await page.setViewportSize({width,height:860});await m.back();const title=page.getByRole('heading',{name:'短句資料庫',exact:true});
  const baseline=await title.boundingBox();const type=await title.evaluate(n=>{const s=getComputedStyle(n);return [s.fontSize,s.fontWeight,s.lineHeight]});
  for(const [name,key]of [['本次 prompt 素材','materials'],['設定','settings'],['AI 教學','ai']]){
   await page.getByRole('button',{name,exact:true}).click();const heading=page.getByRole('heading',{name,exact:true});await expect(heading).toBeVisible();const box=await heading.boundingBox();expect(box.x).toBeCloseTo(baseline.x,0);expect(box.y).toBeCloseTo(baseline.y,0);expect(await heading.evaluate(n=>{const s=getComputedStyle(n);return [s.fontSize,s.fontWeight,s.lineHeight]})).toEqual(type);await page.screenshot({path:`artifacts/title-alignment/${key}-${width}.png`});
  }
 }
 await m.back();await expect(m.text).toHaveValue('標題對齊也要保留草稿');
});

