import {test,expect} from './fixture.js';
import {getRoleTranslations} from '../../src/roles.js';
test('agent picker shows exact command instead of usage scenario',async({page})=>{
 await page.goto('/?picker');
 const items=getRoleTranslations('agent','zh-TW');
 await page.evaluate(items=>qa.emit('picker-state',{role:'agent',items,selected:0}),items);
 for(const item of items){
  await expect(page.getByText(item.text,{exact:true}).first()).toBeVisible();
  await expect(page.getByText(item.scenario,{exact:true})).toHaveCount(0);
 }
 await expect(page.getByText('[Shift+Tab]',{exact:true})).toHaveCount(2);
});
