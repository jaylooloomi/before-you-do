import {test,expect} from './fixture.js';
test('E13/E17 picker snapshots and role events render independent view',async({page})=>{
 await page.goto('/?picker');await expect(page.getByText('快捷提示詞',{exact:true})).toBeVisible();for(const name of ['理解後直接進行','先規劃，不實作','實作測試'])await expect(page.getByText(name,{exact:true})).toBeInViewport();await page.evaluate(()=>qa.emit('picker-state',{role:'developer',items:[{name:'事件資料',text:'正文'}],selected:2}));await expect(page.getByText('事件資料',{exact:true})).toBeVisible();await expect(page.getByText('程式開發',{exact:true})).toBeVisible();await expect(page.getByText(/放開 Alt 開啟/)).toBeVisible();await page.reload();await expect(page.getByText('理解後直接進行',{exact:true})).toBeVisible();
});
test('E14/E15 malicious text and empty snapshots retain add/settings',async({page})=>{
 await page.goto('/?picker');await page.evaluate(()=>qa.emit('picker-state',{role:'personal',items:[{name:'<script>window.hacked=1</script>',text:'x'.repeat(20000),scenario:'情境'}],selected:0}));await expect(page.getByText('<script>window.hacked=1</script>',{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.hacked||0)).toBe(0);for(let i=0;i<3;i++)await page.evaluate(()=>qa.emit('picker-state',{items:[],selected:0}));await expect(page.getByText('新增快捷提示詞',{exact:true})).toHaveCount(1);await expect(page.getByText('設定',{exact:true})).toBeVisible();
});
test('E16 startup IPC failure reports error and reload recovers',async({page})=>{
 await page.goto('/?picker&qaFail=picker_state');await expect(page.getByRole('alert')).toContainText('無法載入短句');
 await expect(page.getByRole('alert')).toContainText('無法讀取短句檔');
 await page.evaluate(()=>history.replaceState(null,'','/?picker'));
 await page.getByRole('button',{name:'重新載入',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByText('理解後直接進行',{exact:true})).toBeVisible();
});
for(const [width,height]of [[580,480],[390,844],[1920,1080]])test(`E18 picker viewport ${width}`,async({page})=>{await page.setViewportSize({width,height});await page.goto('/?picker');await expect(page.getByText('新增快捷提示詞',{exact:true})).toBeInViewport();await expect(page.getByText('設定',{exact:true})).toBeInViewport();await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('zh-TW');await page.screenshot({path:`artifacts/qa/picker-${width}.png`});});
