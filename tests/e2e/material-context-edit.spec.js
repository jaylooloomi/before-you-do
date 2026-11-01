import {test,expect,Manager} from './fixture.js';
async function open(page){await new Manager(page).open();await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;canvas.getContext('2d').fillRect(0,0,200,100);qa.mediaPreviews={shot:canvas.toDataURL()};qa.state.materials.items=[{id:'shot',name:'sample.png',kind:'image',text:'',size:100},{id:'gif',name:'animated.gif',kind:'image',text:'',size:20},{id:'text',name:'Text',kind:'text',text:'Keep',size:0}];});await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();}
test('image right-click offers annotate/redact, cancellation keeps data; dots menu shares action',async({page})=>{
 await open(page);const card=page.getByRole('listitem',{name:'01 · sample.png',exact:true});await card.getByRole('img').click({button:'right'});const menu=page.getByRole('menu',{name:'素材選單',exact:true});await expect(menu.getByRole('menuitem',{name:'標註／遮蔽 1',exact:true})).toBeVisible();await menu.getByRole('menuitem',{name:'標註／遮蔽 1',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();expect(await page.evaluate(()=>qa.count('materials_replace_image'))).toBe(0);await card.getByRole('button',{name:'素材選單 1',exact:true}).click();await expect(card.getByRole('button',{name:'標註／遮蔽 1',exact:true})).toBeVisible();await page.keyboard.press('Escape');await page.getByRole('button',{name:'素材選單 2',exact:true}).click();await expect(page.getByRole('button',{name:'標註／遮蔽 2',exact:true})).toHaveCount(0);
});
test('context action uses existing editor save path and stays within viewport',async({page})=>{
 await open(page);const card=page.getByRole('listitem',{name:'01 · sample.png',exact:true});await card.dispatchEvent('contextmenu',{clientX:935,clientY:815});const menu=page.getByRole('menu',{name:'素材選單',exact:true});await expect(menu).toBeInViewport({ratio:1});await menu.getByRole('menuitem',{name:'標註／遮蔽 1',exact:true}).click();const canvas=page.getByRole('dialog').locator('canvas'),box=await canvas.boundingBox();await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.up();await page.getByRole('button',{name:'儲存並永久取代',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);const call=await page.evaluate(()=>qa.calls.find(c=>c.cmd==='materials_replace_image'));expect(call.args.itemId).toBe('shot');expect(call.args.bytes.slice(0,8)).toEqual([137,80,78,71,13,10,26,10]);
});

test('copy context action copies current image pixels and flushes text; file copy retains original type',async({page})=>{
 await open(page);
 const card=page.getByRole('listitem',{name:'01 · sample.png',exact:true});await card.getByRole('img').click({button:'right'});
 await page.getByRole('menuitem',{name:'複製素材 1',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_copy').length)).toBe(1);
 const copied=await page.evaluate(()=>qa.calls.find(c=>c.cmd==='materials_copy').args);expect(copied.itemId).toBe('shot');expect(copied.imagePng.slice(0,8)).toEqual([137,80,78,71,13,10,26,10]);
 await page.getByRole('button',{name:'素材選單 2',exact:true}).click();await page.getByRole('button',{name:'複製素材 2',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_copy').at(-1)?.args)).toEqual({itemId:'gif',imagePng:null});
 const text=page.getByRole('textbox',{name:'任務文字 3',exact:true});await text.fill('Latest unsaved material text');
 await page.getByRole('button',{name:'素材選單 3',exact:true}).click();await page.getByRole('button',{name:'複製素材 3',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_copy').at(-1)?.args.itemId)).toBe('text');
 expect(await page.evaluate(()=>qa.state.materials.items.find(i=>i.id==='text').text)).toBe('Latest unsaved material text');
 await page.evaluate(()=>qa.failures.materials_copy='Clipboard busy');await card.getByRole('img').click({button:'right'});await page.getByRole('menuitem',{name:'複製素材 1',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Clipboard busy'})).toBeVisible();expect(await page.evaluate(()=>qa.state.materials.items.length)).toBe(3);
});
