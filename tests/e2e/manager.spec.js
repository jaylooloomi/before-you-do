import {test,expect,Manager} from './fixture.js';
test('E01 create scenario, save and refresh',async({page})=>{
 const m=new Manager(page);await m.open();await page.getByRole('button',{name:'新增短句',exact:true}).click();await m.name.fill('新增測試');await m.text.fill('正文');await m.scenario.fill('使用場景');await m.save.click();await expect.poll(()=>page.evaluate(()=>qa.state.files.personal.at(-1))).toEqual({name:'新增測試',text:'正文',scenario:'使用場景'});await page.reload();await page.getByRole('button',{name:/新增測試/}).click();await expect(m.scenario).toHaveValue('使用場景');
});
test('E02 drafts, injection, multi-term search and error focus',async({page})=>{
 const m=new Manager(page);await m.open();await page.getByRole('button',{name:'新增短句',exact:true}).click();await m.name.fill('<script>window.hacked=1</script>');await m.scenario.fill("SQL ' OR 1=1");await m.save.click();await expect(page.getByRole('button',{name:/第 4 筆/})).toBeVisible();await expect.poll(()=>page.evaluate(()=>qa.state.files.personal.length)).toBe(3);await page.getByRole('button',{name:/第 4 筆/}).click();await expect(m.text).toBeFocused();await expect.poll(()=>page.evaluate(()=>window.hacked||0)).toBe(0);await page.getByPlaceholder('搜尋短句').fill('理解 需求');await expect(page.getByRole('button',{name:/理解後直接進行 先整理/})).toBeVisible();
});
test('E03 delayed save blocks duplicate submit and restores editability',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('更新');await page.evaluate(()=>qa.hold('save_snippets'));await m.save.click();await expect.poll(()=>m.text.evaluate(e=>e.closest('form').inert)).toBe(true);await page.keyboard.press('Control+s');await expect.poll(()=>page.evaluate(()=>qa.count('save_snippets'))).toBe(1);await page.evaluate(()=>qa.release('save_snippets'));await expect(m.text).toBeEditable();await expect.poll(()=>page.evaluate(()=>qa.state.files.personal[0].text)).toBe('更新');
});
test('E03 empty persisted response can recover by adding',async({page})=>{
 await page.goto('/');await expect(page.getByRole('textbox',{name:'短句名稱',exact:true})).toBeVisible();await page.evaluate(()=>{qa.state.files.personal=[];localStorage.setItem('qa.disk',JSON.stringify(qa.state));});await page.reload();await page.getByRole('button',{name:'新增短句',exact:true}).click();const m=new Manager(page);await m.name.fill('復原');await m.text.fill('內容');await m.save.click();await expect.poll(()=>page.evaluate(()=>qa.state.files.personal.length)).toBe(1);
});
test('E04 save and role failure preserve inputs and unlock UI',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('不能丟失');await page.evaluate(()=>qa.failures.save_snippets='error.external_change');await m.save.click();await expect(m.text).toBeEditable();await expect(m.text).toHaveValue('不能丟失');await expect(page.getByRole('status').filter({hasText:/外部/}).last()).toBeVisible();await page.evaluate(()=>qa.failures.switch_role='error.read');await page.getByRole('button',{name:/程式開發 實作/}).click();await expect(m.text).toHaveValue('不能丟失');await expect(m.text).toBeEditable();
});
test('E05 role drafts, reorder, delete cancellation and query history',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('草稿保留');await page.getByRole('button',{name:/程式開發 實作/}).click();await page.getByRole('button',{name:/我的短句.*保留/}).click();await expect(m.text).toHaveValue('草稿保留');await page.getByRole('button',{name:'下移短句',exact:true}).click();await m.save.click();await expect.poll(()=>page.evaluate(()=>qa.state.files.personal[1].text)).toBe('草稿保留');await page.getByRole('button',{name:'刪除',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await expect(m.text).toHaveValue('草稿保留');await page.goto('/?qa=history');await expect(m.name).toBeVisible();await page.goto('/?picker');await expect(page.getByText('快捷提示詞',{exact:true})).toBeVisible();await page.goBack();await expect(m.name).toBeVisible();await page.goForward();await expect(page.getByText('快捷提示詞',{exact:true})).toBeVisible();
});
for(const [width,height]of [[1920,1080],[780,680]])test(`E06 desktop controls reachable ${width}`,async({page})=>{
 await page.setViewportSize({width,height});const m=new Manager(page);await m.open();await m.save.click({trial:true});await page.screenshot({path:`artifacts/qa/manager-${width}.png`});
});
test('E06 mobile outside native minimum records layout boundary',async({page},info)=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'短句資料庫'})).toBeVisible();await page.screenshot({path:'artifacts/qa/manager-mobile.png'});await info.attach('unsupported-viewport',{body:'390px < Tauri minWidth 780px. This is an observation, not mobile support acceptance.',contentType:'text/plain'});});
test('E05 exit guard covers other-role drafts; Alt+H manager dismisses only',async({page})=>{
 const m=new Manager(page);await m.open();await m.text.fill('個人草稿');await page.getByRole('button',{name:/程式開發 實作/}).click();await m.text.fill('開發草稿');await page.evaluate(()=>qa.emit('quit-requested',null));const dialog=page.getByRole('dialog');await expect(dialog).toContainText('我的短句');await expect(dialog).toContainText('程式開發');await page.evaluate(()=>qa.emit('quit-requested',null));await expect(dialog).toHaveCount(1);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(m.text).toHaveValue('開發草稿');await page.keyboard.press('Alt+h');await expect.poll(()=>page.evaluate(()=>qa.count('dismiss_manager_shortcut'))).toBe(1);await expect.poll(()=>page.evaluate(()=>qa.count('confirm_quit'))).toBe(0);
});
test('E04 manager startup failure blocks editing and reload recovers',async({page})=>{
 await page.goto('/?qaFail=get_snippets');await expect(page.getByRole('alert')).toContainText('無法載入短句');
 await expect.poll(()=>page.evaluate(()=>qa.count('save_snippets'))).toBe(0);
 await page.evaluate(()=>history.replaceState(null,'','/'));
 await page.getByRole('button',{name:'重新載入',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(new Manager(page).name).toHaveValue('理解後直接進行');
});
test('B06 Unicode input limits preserve full emoji values on save and reload',async({page})=>{
 const m=new Manager(page);await m.open();const name='😀'.repeat(100),text='😀'.repeat(20000),scenario='😀'.repeat(1000);
 await m.name.fill(name);await m.text.fill(text);await m.scenario.fill(scenario);await m.save.click();
 await expect.poll(()=>page.evaluate(()=>qa.state.files.personal[0])).toEqual({name,text,scenario});
 await page.reload();await expect(m.name).toHaveValue(name);await expect(m.text).toHaveValue(text);await expect(m.scenario).toHaveValue(scenario);
 await expect(page.getByText('20000 字',{exact:true})).toBeVisible();
 await m.name.fill(name+'😀');await m.save.click();await expect(page.getByRole('button',{name:/第 1 筆/})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>qa.state.files.personal[0].name)).toBe(name);
});
