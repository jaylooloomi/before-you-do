import {test,expect} from './fixture.js';
async function open(page){await page.goto('/?materials-quick');await page.evaluate(()=>{qa.state.materials.items=[1,2,3].map(id=>({id:String(id),kind:'text',name:'Task '+id,text:'Text '+id,size:0}));qa.emit('materials-quick-refresh',{hold:true});});await expect(page.getByRole('option')).toHaveCount(3);}
const actions=page=>page.evaluate(()=>qa.calls.filter(c=>c.cmd==='materials_quick_action').map(c=>c.args.action));
test('Alt held: vertical selection, left default paste and release exactly once',async({page})=>{
 await open(page);await page.keyboard.down('Alt');await page.keyboard.press('ArrowDown');await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');await page.keyboard.press('ArrowRight');await expect(page.getByRole('button',{name:'清空',exact:true})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('ArrowLeft');await page.keyboard.press('m');await page.keyboard.up('Alt');await expect.poll(()=>actions(page)).toEqual(['paste']);await page.evaluate(()=>qa.emit('materials-quick-release'));expect(await actions(page)).toEqual(['paste']);
});
test('right selects main window; Escape cancels release and resets default next open',async({page})=>{
 await open(page);await page.keyboard.down('Alt');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('m');await page.keyboard.up('Alt');await expect.poll(()=>actions(page)).toEqual(['main']);await page.evaluate(()=>qa.emit('materials-quick-refresh',{hold:true}));await page.keyboard.down('Alt');await page.keyboard.press('Escape');await page.keyboard.up('Alt');await expect.poll(()=>actions(page)).toEqual(['main','close']);await page.evaluate(()=>qa.emit('materials-quick-refresh',{hold:true}));await expect(page.getByRole('button',{name:/整包貼上/})).toHaveAttribute('aria-pressed','true');
});
test('release during loading waits; hidden or blur invalidates deferred execution',async({page})=>{
 await open(page);await page.evaluate(()=>{qa.hold('materials_quick_snapshot');qa.emit('materials-quick-refresh',{hold:true});qa.emit('materials-quick-release');});expect(await actions(page)).toEqual([]);await page.evaluate(()=>qa.release('materials_quick_snapshot'));await expect.poll(()=>actions(page)).toEqual(['paste']);await page.evaluate(()=>{qa.hold('materials_quick_snapshot');qa.emit('materials-quick-refresh',{hold:true});qa.emit('materials-quick-release');qa.emit('materials-quick-hidden');qa.release('materials_quick_snapshot');});expect(await actions(page)).toEqual(['paste']);await page.evaluate(()=>{qa.emit('materials-quick-refresh',{hold:true});window.dispatchEvent(new Event('blur'));qa.emit('materials-quick-release');});expect(await actions(page)).toEqual(['paste']);
});

test('vertical arrows still select materials when a footer button retained focus',async({page})=>{await open(page);await page.getByRole('button',{name:'開啟主視窗',exact:true}).focus();await page.keyboard.down('Alt');await page.keyboard.press('ArrowDown');await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await page.keyboard.up('Alt');await expect.poll(()=>actions(page)).toEqual(['close']);});

test('Alt+L native release survives startup blur, needs no paste shortcut, and rejects stale tickets',async({page})=>{
 await open(page);await page.evaluate(()=>{qa.state.captureHotkeys.config.quick='Alt+L';qa.state.captureHotkeys.config.paste='';qa.emit('materials-quick-refresh',{hold:true,ticket:42});window.dispatchEvent(new Event('blur'));qa.emit('materials-quick-release',{verified:true,ticket:41});});expect(await actions(page)).toEqual([]);await expect(page.getByRole('button',{name:'整包貼上',exact:true})).toBeEnabled();await page.evaluate(()=>qa.emit('materials-quick-release',{verified:true,ticket:42}));await expect.poll(()=>actions(page)).toEqual(['paste']);await page.evaluate(()=>qa.emit('materials-quick-release',{verified:true,ticket:42}));expect(await actions(page)).toEqual(['paste']);
});

test('verified native release is retained while loading even if a delayed startup blur follows',async({page})=>{
 await open(page);await page.evaluate(()=>{qa.hold('materials_quick_snapshot');qa.emit('materials-quick-refresh',{hold:true,ticket:51});qa.emit('materials-quick-release',{verified:true,ticket:51});window.dispatchEvent(new Event('blur'));});expect(await actions(page)).toEqual([]);await page.evaluate(()=>qa.release('materials_quick_snapshot'));await expect.poll(()=>actions(page)).toEqual(['paste']);
});

test('Alt+L matches Alt+H: L release does nothing, Alt release runs selected action once',async({page})=>{
 await open(page);await page.evaluate(()=>{qa.state.captureHotkeys.config.quick='Alt+L';qa.emit('materials-quick-refresh',{hold:true,ticket:70});});await expect(page.getByRole('option')).toHaveCount(3);await page.keyboard.down('Alt');await page.keyboard.down('l');await page.keyboard.up('l');expect(await actions(page)).toEqual([]);await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');await page.keyboard.up('Alt');await expect.poll(()=>actions(page)).toEqual(['paste']);await page.evaluate(()=>qa.emit('materials-quick-release',{verified:true,ticket:70}));expect(await actions(page)).toEqual(['paste']);
});

test('native keyboard events navigate a non-activating panel and release once',async({page})=>{
 await open(page);await page.evaluate(()=>qa.emit('materials-quick-refresh',{hold:true,ticket:80}));await expect(page.getByRole('button',{name:/整包貼上/})).toBeEnabled();await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));qa.emit('materials-quick-key','ArrowDown');qa.emit('materials-quick-key','ArrowRight');qa.emit('materials-quick-key','ArrowRight');});await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');await expect(page.getByRole('button',{name:'開啟主視窗',exact:true})).toHaveAttribute('aria-pressed','true');await page.evaluate(()=>{qa.emit('materials-quick-key','ArrowLeft');qa.emit('materials-quick-key','ArrowLeft');qa.emit('materials-quick-release',{verified:true,ticket:80});});await expect.poll(()=>actions(page)).toEqual(['paste']);
});

test('clear sits between paste and main, requires confirmation and Escape cancels without clearing',async({page})=>{
 await open(page);await page.evaluate(()=>qa.emit('materials-quick-refresh',{hold:true,ticket:91}));await expect(page.getByRole('button',{name:/整包貼上/})).toBeEnabled();await page.evaluate(()=>{qa.emit('materials-quick-key','ArrowRight');qa.emit('materials-quick-release',{verified:true,ticket:91});});await expect(page.getByRole('button',{name:'確認清空',exact:true})).toBeVisible();expect(await actions(page)).toEqual(['clear-confirm']);expect(await page.evaluate(()=>qa.state.materials.items.length)).toBe(3);await page.evaluate(()=>qa.emit('materials-quick-key','Escape'));await expect.poll(()=>actions(page)).toEqual(['clear-confirm','close']);expect(await page.evaluate(()=>qa.state.materials.items.length)).toBe(3);
 await page.evaluate(()=>qa.emit('materials-quick-refresh',{hold:true,ticket:92}));await expect(page.getByRole('button',{name:'清空',exact:true})).toBeEnabled();await page.getByRole('button',{name:'清空',exact:true}).click();await page.getByRole('button',{name:'確認清空',exact:true}).click();await expect.poll(()=>actions(page)).toEqual(['clear-confirm','close','clear-confirm','clear']);
});

test('empty workspace closes on native Alt release without pasting, including release during load',async({page})=>{
 await open(page);
 await page.evaluate(()=>{qa.state.materials.items=[];qa.hold('materials_quick_snapshot');qa.emit('materials-quick-refresh',{hold:true,ticket:101});qa.emit('materials-quick-release',{verified:true,ticket:101});});
 expect(await actions(page)).toEqual([]);
 await page.evaluate(()=>qa.release('materials_quick_snapshot'));
 await expect.poll(()=>actions(page)).toEqual(['close']);
 await page.evaluate(()=>qa.emit('materials-quick-release',{verified:true,ticket:101}));
 expect(await actions(page)).toEqual(['close']);
 await page.evaluate(()=>qa.emit('materials-quick-refresh',{hold:true,ticket:102}));
 await expect(page.getByRole('button',{name:/整包貼上/})).toBeDisabled();
 await page.evaluate(()=>{qa.emit('materials-quick-key','ArrowRight');qa.emit('materials-quick-release',{verified:true,ticket:102});});
 await expect.poll(()=>actions(page)).toEqual(['close','close']);
 await page.evaluate(()=>qa.emit('materials-quick-refresh',{hold:true,ticket:103}));
 await expect(page.getByRole('button',{name:'開啟主視窗',exact:true})).toBeEnabled();
 await page.evaluate(()=>{qa.emit('materials-quick-key','ArrowRight');qa.emit('materials-quick-key','ArrowRight');qa.emit('materials-quick-release',{verified:true,ticket:103});});
 await expect.poll(()=>actions(page)).toEqual(['close','close','main']);
});
