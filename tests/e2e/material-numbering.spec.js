import {test,expect,Manager} from './fixture.js';
test('visible numbers, selected preview and copied prompt follow drag and deletion',async({page})=>{
 // Keep all three drag handles in view so locator.dragTo does not scroll its source away while locating the target.
 await page.setViewportSize({width:1280,height:1200});
 const m=new Manager(page);await m.open();await m.text.fill('短句草稿保留');
 await page.evaluate(()=>{qa.state.materials={items:[{id:'task',kind:'text',name:'Task',text:'任務草稿',size:0},{id:'one',kind:'file',name:'one.txt',text:'',size:3},{id:'two',kind:'file',name:'two.txt',text:'',size:3}]};});
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 const card=n=>page.getByRole('listitem').nth(n);await expect(card(0).getByText('#01',{exact:true})).toBeVisible();await expect(card(2).getByText('#03',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'預覽素材 3',exact:true}).click();await expect(page.getByRole('heading',{name:'#03 · two.txt',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'拖曳素材 3',exact:true}).dragTo(card(0));await expect(card(0)).toHaveAccessibleName('01 · two.txt');await expect(card(0).getByText('#01',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'#01 · two.txt',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'複製整合文字',exact:true}).click();expect(await page.evaluate(()=>qa.calls.filter(c=>c.cmd==='copy_text').at(-1).args.text)).toBe('[Material #01]\n[Attachment: 01-two.txt]\n\n[Material #02]\n任務草稿\n\n[Material #03]\n[Attachment: 03-one.txt]');
 await page.getByRole('button',{name:'移除素材 1',exact:true}).click();await expect(card(0).getByText('#01',{exact:true})).toBeVisible();await expect(card(1).getByText('#02',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'#01 · 任務文字',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/numbered-materials.png',animations:'disabled'});await page.getByRole('button',{name:'常用短句',exact:true}).click();await expect(m.text).toHaveValue('短句草稿保留');expect(await page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
});

