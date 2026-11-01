import {test,expect,Manager} from './fixture.js';
test('capture preferences are always visible beside the workspace tools at supported sizes',async({page})=>{
 await new Manager(page).open();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 for(const [width,height]of [[1280,879],[940,820],[780,680]]){await page.setViewportSize({width,height});const options=page.getByRole('group',{name:'截圖選項',exact:true});await expect(options).toBeVisible();for(const name of ['自動偵測','像素放大鏡']){const input=options.getByRole('checkbox',{name,exact:true});await expect(input).toBeInViewport({ratio:1});await input.click({trial:true});}await page.screenshot({animations:'disabled',path:'artifacts/inline-capture-options-'+width+'.png'});}
});
test('role cards use one horizontal row, arrow scrolling and keyboard role changes',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('保留我的草稿');const group=page.getByRole('group',{name:'選擇角色',exact:true});const cards=group.getByRole('button',{name:/^(?!設為預設角色|取消預設角色)/});const first=await cards.nth(0).boundingBox(),last=await cards.nth(12).boundingBox();expect(first.y).toBe(last.y);const before=await group.evaluate(e=>e.scrollLeft);await page.getByRole('button',{name:'向右捲動角色',exact:true}).click();await expect.poll(()=>group.evaluate(e=>e.scrollLeft)).toBeGreaterThan(before);await cards.nth(12).click();await expect.poll(()=>page.evaluate(()=>window.qa.state.role)).toBe('project');await cards.nth(0).click();await expect(m.text).toHaveValue('保留我的草稿');await cards.nth(0).focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>page.evaluate(()=>window.qa.state.role)).toBe('agent');await page.screenshot({animations:'disabled',path:'artifacts/horizontal-role-cards.png'});expect(await page.evaluate(()=>window.qa.count('save_snippets'))).toBe(0);
});

test('library roles stay above the editor and return after materials/settings without losing drafts',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('不可遺失的草稿');
 const roles=page.getByRole('group',{name:'選擇角色',exact:true});
 for(const [width,height]of [[940,820],[1280,860]]){
  await page.setViewportSize({width,height});const roleBox=await roles.boundingBox(),editorBox=await m.text.boundingBox();expect(roleBox.x).toBeGreaterThan(230);expect(roleBox.y).toBeLessThan(editorBox.y);
  await page.getByRole('button',{name:'儲存短句',exact:true}).click({trial:true});
 }
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(roles).toBeHidden();
 await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('不可遺失的草稿');
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('不可遺失的草稿');expect((await roles.boundingBox()).x).toBeGreaterThan(230);
 await page.screenshot({animations:'disabled',path:'artifacts/library-right-role-cards.png'});expect(await page.evaluate(()=>window.qa.count('save_snippets'))).toBe(0);
});
