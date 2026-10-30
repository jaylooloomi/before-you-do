import {test,expect,Manager} from './fixture.js';
test('capture settings opens above the bottom toolbar within both supported viewports',async({page})=>{
 await new Manager(page).open();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 for(const [width,height]of [[1280,879],[940,820],[780,680]]){await page.setViewportSize({width,height});const summary=page.getByText('截圖快捷鍵與選項',{exact:true});const tool=page.getByRole('button',{name:'區域截圖',exact:true});const a=await summary.boundingBox(),b=await tool.boundingBox();expect(a.y).toBeGreaterThan(height/2);expect(Math.abs(a.y-b.y)).toBeLessThan(160);await summary.click();const save=page.getByRole('button',{name:'儲存截圖快捷鍵',exact:true});await expect(save).toBeInViewport({ratio:1});await save.click({trial:true});const input=page.getByRole('textbox',{name:'區域截圖',exact:true});await expect(input).toBeVisible();expect((await input.boundingBox()).y).toBeLessThan(a.y);await page.screenshot({animations:'disabled',path:`artifacts/toolbar-settings-${width}.png`});await page.keyboard.press('Escape');await expect(input).toBeHidden();}
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
 await page.getByRole('button',{name:'設定與 AI 教學',exact:true}).click();await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('不可遺失的草稿');expect((await roles.boundingBox()).x).toBeGreaterThan(230);
 await page.screenshot({animations:'disabled',path:'artifacts/library-right-role-cards.png'});expect(await page.evaluate(()=>window.qa.count('save_snippets'))).toBe(0);
});
