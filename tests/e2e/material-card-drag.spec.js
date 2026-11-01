import {test,expect,Manager} from './fixture.js';
test.setTimeout(90000);
test('dragging an image body and a card surface reorders and persists numbering',async({page})=>{
 await page.setViewportSize({width:1280,height:1200});const m=new Manager(page);await m.open();await m.text.fill('Preserve snippet draft');
 await page.evaluate(()=>{qa.state.materials.items=[{id:'one',kind:'image',name:'one.png',text:'',size:3},{id:'two',kind:'image',name:'two.png',text:'',size:3},{id:'text',kind:'text',name:'Text',text:'Keep task text',size:0}];});
 await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();
 const first=()=>page.getByRole('listitem').nth(0);
 await page.getByRole('img',{name:'two.png',exact:true}).dragTo(first());
 await expect.poll(()=>page.evaluate(()=>qa.state.materials.items.map(i=>i.id))).toEqual(['two','one','text']);
 await expect(first()).toHaveAccessibleName('01 · two.png');await expect(first().getByText('#01',{exact:true})).toBeVisible();
 await page.getByRole('listitem',{name:'03 · 任務文字',exact:true}).dragTo(first(),{sourcePosition:{x:12,y:60}});
 await expect.poll(()=>page.evaluate(()=>qa.state.materials.items.map(i=>i.id))).toEqual(['text','two','one']);
 await expect(first()).toHaveAccessibleName('01 · 任務文字');await expect(page.getByRole('textbox',{name:'任務文字 1',exact:true})).toHaveValue('Keep task text');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(first()).toHaveAccessibleName('01 · 任務文字');
});
test('dragging inside text input does not start material reorder',async({page})=>{
 const m=new Manager(page);await m.open();await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await page.getByRole('button',{name:'加入文字',exact:true}).click();
 const input=page.getByRole('textbox',{name:'任務文字 1',exact:true});await input.fill('Editable text');
 const prevented=await input.evaluate(node=>{const event=new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()});node.dispatchEvent(event);return event.defaultPrevented;});expect(prevented).toBe(true);expect(await page.evaluate(()=>qa.count('materials_order'))).toBe(0);await expect(input).toHaveValue('Editable text');
});
