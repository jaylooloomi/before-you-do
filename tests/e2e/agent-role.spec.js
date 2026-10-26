import {test,expect,Manager} from './fixture.js';
test('agent commands can be selected between personal and developer without losing a draft',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('保留這份未儲存草稿');
 await page.getByRole('button',{name:/代理指令 Claude Code/}).click();
 await expect(m.text).toHaveValue('claude --dangerously-skip-permissions');
 await page.getByRole('button',{name:/Codex：略過確認與沙箱/}).click();
 await expect(m.text).toHaveValue('codex --dangerously-bypass-approvals-and-sandbox');
 await page.getByRole('button',{name:/我的短句.*保留原本/}).click();
 await expect(m.text).toHaveValue('保留這份未儲存草稿');
});
