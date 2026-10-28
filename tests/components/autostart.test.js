import {test,expect,vi} from 'vitest';
import {screen,waitFor} from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import {createAutostartSetting} from '../../src/autostart-setting.js';
import {setLanguage} from '../../src/i18n.js';
async function mount(invoke){setLanguage('zh-TW');const widget=createAutostartSetting(invoke);document.body.append(widget.card);await widget.refresh();return widget;}
test('autostart is read from native state and pending changes prevent duplicate writes',async()=>{
 let release;const invoke=vi.fn(async cmd=>cmd==='get_autostart'?{supported:true,enabled:false}:new Promise(resolve=>release=()=>resolve({supported:true,enabled:true})));
 await mount(invoke);const toggle=screen.getByRole('checkbox');expect(toggle.checked).toBe(false);
 await userEvent.click(toggle);expect(toggle.disabled).toBe(true);await userEvent.click(toggle);
 expect(invoke.mock.calls.filter(([cmd])=>cmd==='set_autostart')).toHaveLength(1);
 release();await waitFor(()=>expect(toggle.disabled).toBe(false));expect(toggle.checked).toBe(true);
});
test('a rejected write rolls back the switch and exposes an error',async()=>{
 await mount(async cmd=>{if(cmd==='get_autostart')return {supported:true,enabled:true};throw 'Access denied';});
 const toggle=screen.getByRole('checkbox');await userEvent.click(toggle);
 await waitFor(()=>expect(screen.getByText(/未能更新啟動設定/)).toBeTruthy());expect(toggle.checked).toBe(true);expect(toggle.disabled).toBe(false);
});
test('unsupported or unreadable startup settings never present an actionable switch',async()=>{
 const widget=await mount(async()=>({supported:false,enabled:false}));expect(screen.getByRole('checkbox').disabled).toBe(true);
 widget.card.remove();await mount(async()=>{throw 'Access denied';});expect(screen.getByRole('checkbox').disabled).toBe(true);expect(screen.getByText(/無法讀取啟動設定/)).toBeTruthy();
});
