import {test,expect,Manager} from './fixture.js';
test('AI guide keeps optional reference sections folded without hiding primary actions',async({page})=>{
 const m=new Manager(page);await m.open();await m.guide();
 for(const title of ['怎麼請 AI 修改比較有效？','備份與還原']){const summary=page.getByText(title,{exact:true});await expect(summary).toBeVisible();await expect(summary.locator('..')).not.toHaveAttribute('open');await summary.click();await expect(summary.locator('..')).toHaveAttribute('open','');await summary.click();}
 await expect(page.getByRole('button',{name:'複製聊天 AI 指令與短句',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'複製短句 JSON',exact:true})).toBeVisible();await expect(page.getByText('套用前會備份；將取代此角色的短句、排序與草稿。',{exact:true})).toBeVisible();
});
