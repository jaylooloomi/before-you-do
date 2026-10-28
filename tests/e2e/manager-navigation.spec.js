import {test,expect,Manager} from './fixture.js';
import {getRoleDefaults} from '../../src/roles.js';
const leaveEditor=page=>page.getByRole('heading',{name:'短句資料庫',exact:true}).click();

test('manager arrows switch roles and snippets while preserving drafts and per-role selection',async({page})=>{
 const m=new Manager(page);await m.open();const saved=await page.evaluate(()=>JSON.stringify(qa.state.files.personal));
 await leaveEditor(page);await page.keyboard.press('ArrowDown');await expect(m.name).toHaveValue('先規劃，不實作');
 await page.keyboard.press('ArrowUp');await expect(m.name).toHaveValue('理解後直接進行');
 await page.keyboard.press('ArrowUp');await expect(m.name).toHaveValue('實作測試');
 await m.text.fill('個人角色的未儲存編輯');await m.scenario.fill('也保留這個情境');await leaveEditor(page);
 await page.keyboard.press('ArrowRight');await expect(m.text).toHaveValue(getRoleDefaults('agent','zh-TW')[0].text);
 await page.keyboard.press('ArrowDown');await expect(m.text).toHaveValue('claude --resume');
 await page.keyboard.press('ArrowLeft');await expect(m.text).toHaveValue('個人角色的未儲存編輯');await expect(m.scenario).toHaveValue('也保留這個情境');
 await page.keyboard.press('ArrowRight');await expect(m.text).toHaveValue('claude --resume');
 // Role-card focus must activate the next role, not merely move focus to its card.
 await page.getByRole('button',{name:/^代理指令 Claude Code/}).focus();await page.keyboard.press('ArrowRight');
 await expect.poll(()=>page.evaluate(()=>qa.state.role)).toBe('developer');
 expect(await page.evaluate(()=>JSON.stringify(qa.state.files.personal))).toBe(saved);
});

test('arrows respect search results and leave text inputs, select controls and dialogs alone',async({page})=>{
 const m=new Manager(page);await m.open();
 await m.text.fill('ABCD');await m.text.evaluate(e=>e.setSelectionRange(2,2));await page.keyboard.press('ArrowLeft');
 expect(await m.text.evaluate(e=>e.selectionStart)).toBe(1);expect(await page.evaluate(()=>qa.state.role)).toBe('personal');
 await m.name.focus();await page.keyboard.press('ArrowDown');await expect(m.text).toHaveValue('ABCD');
 await page.getByPlaceholder('搜尋短句').fill('實作');await leaveEditor(page);await page.keyboard.press('ArrowDown');await expect(m.name).toHaveValue('先規劃，不實作');
 await page.keyboard.press('ArrowDown');await expect(m.name).toHaveValue('實作測試');
 await page.keyboard.press('ArrowDown');await expect(m.name).toHaveValue('先規劃，不實作');
 await page.getByPlaceholder('搜尋短句').fill('nothing-matches');await leaveEditor(page);await page.keyboard.press('ArrowDown');await expect(m.name).toHaveValue('先規劃，不實作');
 await page.getByPlaceholder('搜尋短句').fill('');await page.getByRole('button',{name:'刪除',exact:true}).click();
 const dialog=page.getByRole('dialog');await page.keyboard.press('ArrowRight');await expect(dialog).toBeVisible();expect(await page.evaluate(()=>qa.state.role)).toBe('personal');
 await page.keyboard.press('Escape');await m.settings();await page.getByRole('combobox',{name:'介面語言',exact:true}).focus();await page.keyboard.press('ArrowRight');
 expect(await page.evaluate(()=>qa.state.role)).toBe('personal');
});

test('role loading rejects repeated arrows and recovers after an IPC failure',async({page})=>{
 const m=new Manager(page);await m.open();await leaveEditor(page);await page.evaluate(()=>qa.hold('switch_role'));
 await page.keyboard.press('ArrowRight');await expect.poll(()=>page.evaluate(()=>qa.count('switch_role'))).toBe(1);
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');expect(await page.evaluate(()=>qa.count('switch_role'))).toBe(1);
 await page.evaluate(()=>qa.release('switch_role'));await expect.poll(()=>page.evaluate(()=>qa.state.role)).toBe('agent');
 await page.evaluate(()=>qa.failures.switch_role='error.read');await page.keyboard.press('ArrowRight');await expect(m.text).toBeEditable();expect(await page.evaluate(()=>qa.state.role)).toBe('agent');
 await page.evaluate(()=>delete qa.failures.switch_role);await page.keyboard.press('ArrowRight');await expect.poll(()=>page.evaluate(()=>qa.state.role)).toBe('developer');
});
