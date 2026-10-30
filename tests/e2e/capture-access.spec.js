import {test,expect,Manager} from './fixture.js';
const required={platform:'macos',supported:true,permission:'required',reason:'error.capture_permission',windowSemantics:'independent_window'};
async function open(page,capability=required){const manager=new Manager(page);await manager.open();await page.evaluate(c=>window.qa.state.captureCapabilities=c,capability);await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();return manager;}
test('permission gates only capture; text and file material flows remain available',async({page})=>{
 await open(page);await expect(page.getByRole('button',{name:'區域截圖',exact:true})).toBeDisabled();await expect(page.getByRole('status',{name:'截圖狀態'})).toContainText('需要螢幕擷取權限');await page.getByRole('button',{name:'加入文字',exact:true}).click();await page.getByRole('textbox',{name:'任務文字 1'}).fill('keep while permission denied');await page.getByRole('button',{name:'授權螢幕擷取',exact:true}).click();await expect(page.getByRole('button',{name:'區域截圖',exact:true})).toBeDisabled();expect(await page.evaluate(()=>window.qa.count('capture_open_permissions'))).toBe(0);
 await page.getByRole('button',{name:'開啟螢幕擷取設定',exact:true}).click();expect(await page.evaluate(()=>window.qa.count('capture_open_permissions'))).toBe(1);
 await page.evaluate(()=>window.qa.permissionDecision='granted');await page.getByRole('button',{name:'授權螢幕擷取',exact:true}).click();await expect(page.getByRole('button',{name:'全螢幕截圖',exact:true})).toBeEnabled();await page.getByRole('button',{name:'全螢幕截圖',exact:true}).click();await expect(page.getByRole('listitem',{name:'02 · fullscreen.png',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'任務文字 1'})).toHaveValue('keep while permission denied');
});
test('older macOS and capability errors do not block task text or original snippet draft',async({page})=>{
 const manager=new Manager(page);await manager.open();await manager.text.fill('original snippet draft');await page.evaluate(c=>window.qa.state.captureCapabilities=c,{...required,supported:false,permission:'unavailable',reason:'error.capture_macos_version'});await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByRole('status',{name:'截圖狀態'})).toContainText('macOS 14');await expect(page.getByRole('button',{name:'全螢幕截圖',exact:true})).toBeDisabled();await page.getByRole('button',{name:'加入文字',exact:true}).click();await page.getByRole('textbox',{name:'任務文字 1'}).fill('still works');await page.evaluate(()=>window.qa.failures.capture_capabilities='error.capture_native');await page.getByRole('button',{name:'重新檢查截圖權限',exact:true}).click();await expect(page.getByRole('status',{name:'截圖狀態'})).toContainText('無法確認截圖能力');await page.getByRole('button',{name:'返回短句',exact:true}).click();await expect(manager.text).toHaveValue('original snippet draft');
});
test('permission revocation and runtime failure report translated errors and recover',async({page})=>{
 await open(page,{...required,permission:'granted',reason:null});await expect(page.getByRole('button',{name:'目前視窗截圖',exact:true})).toBeEnabled();await page.evaluate(c=>window.qa.state.captureCapabilities=c,required);await page.getByRole('button',{name:'目前視窗截圖',exact:true}).click();await expect(page.getByRole('button',{name:'目前視窗截圖',exact:true})).toBeDisabled();expect(await page.evaluate(()=>window.qa.count('capture_start'))).toBe(0);
 await page.evaluate(()=>{window.qa.state.captureCapabilities.permission='granted';window.qa.state.captureCapabilities.reason=null;window.qa.failures.capture_start='error.capture_target';});await page.getByRole('button',{name:'重新檢查截圖權限',exact:true}).click();await page.getByRole('button',{name:'目前視窗截圖',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'素材操作失敗'})).toContainText('請先切換');
 await page.evaluate(()=>delete window.qa.failures.capture_start);await page.getByRole('button',{name:'目前視窗截圖',exact:true}).click();await expect(page.getByRole('listitem',{name:'01 · window.png',exact:true})).toBeVisible();
});
test('permission state and guidance translate into all four languages',async({page})=>{
 await open(page);for(const [language,phrase]of [['en','Screen capture permission is required'],['ja','画面撮影の許可が必要'],['zh-CN','需要屏幕截取权限'],['zh-TW','需要螢幕擷取權限']]){
 await page.getByRole('button',{name:/設定與 AI 教學|Settings & AI guide|设置与 AI 教学|設定と AI/}).click();await page.getByRole('combobox',{name:/介面語言|Interface language|界面语言|表示言語/}).selectOption(language);await page.getByRole('button',{name:/本次 prompt 素材|Prompt workspace|今回のプロンプト素材/,exact:true}).click();await expect(page.getByRole('status',{name:/截圖狀態|截图状态|Capture status|撮影状態/})).toContainText(phrase);
 }
});

test('expired overlay selection reports error, loads current session and can cancel',async({page})=>{
 await page.goto('/?capture-region');await expect(page.getByRole('img')).toHaveAttribute('src',/^data:image/);
 await page.evaluate(()=>window.qa.failures.capture_finish='error.capture_session');
 await page.mouse.move(100,100);await page.mouse.down();await page.mouse.move(200,200);await page.mouse.up();
 await expect(page.getByRole('alert')).toContainText('這次框選已過期');
 await page.evaluate(()=>delete window.qa.failures.capture_finish);await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='capture_finish').length)).toBe(2);
 expect(await page.evaluate(()=>window.qa.calls.filter(c=>c.cmd==='capture_finish').at(-1).args)).toEqual({rect:null,session:null});
});
