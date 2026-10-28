import {test,expect,vi} from 'vitest';
import {screen,waitFor} from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import {createSettingsPage} from '../../src/settings.js';
import {setLanguage} from '../../src/i18n.js';
async function mount(overrides={}){
 setLanguage('zh-TW');const invoke=vi.fn(async cmd=>({get_role:'personal',get_autostart:{supported:true,enabled:false},storage_info:{path:'QA_ONLY/data.json',backup:'QA_ONLY/bak',exists:true},get_snippets:[{name:'n',text:'body',scenario:'s'}]})[cmd]);
 const callbacks={invoke,askConfirmation:vi.fn(async()=>true),onBack:vi.fn(),onReload:vi.fn(async()=>true),onImport:vi.fn(),onAddTemplate:vi.fn(),...overrides};const widget=createSettingsPage(callbacks);document.body.append(widget.panel);widget.panel.hidden=false;await widget.refresh();return callbacks;
}
test('C03 pending copy disables button, copies saved-only JSON, and recovers',async()=>{
 const c=await mount();let release;const pending=new Promise(resolve=>release=resolve);c.invoke.mockImplementation(async cmd=>{if(cmd==='get_snippets')return [{name:'saved',text:'body'}];if(cmd==='copy_text')await pending;});const button=screen.getByRole('button',{name:'複製短句 JSON'});await userEvent.click(button);expect(button.disabled).toBe(true);await userEvent.click(button);expect(c.invoke.mock.calls.filter(([cmd])=>cmd==='copy_text')).toHaveLength(1);release();await waitFor(()=>expect(button.disabled).toBe(false));expect(c.invoke.mock.calls.find(([cmd])=>cmd==='copy_text')[1].text).toContain('saved');
});
test('C03 IPC failure is visible and does not leave disabled action',async()=>{
 const c=await mount();c.invoke.mockRejectedValue('error.read');const button=screen.getByRole('button',{name:'複製修改指令'});await userEvent.click(button);await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('未完成'));expect(button.disabled).toBe(false);
});
test('C04 malformed import is rejected and cancellation preserves draft',async()=>{
 const c=await mount({askConfirmation:vi.fn(async()=>false)});const input=screen.getByRole('textbox',{name:'AI 回傳的短句 JSON'});await userEvent.type(input,'invalid');await userEvent.click(screen.getByRole('button',{name:'檢查並套用 JSON'}));expect(c.onImport).not.toHaveBeenCalled();await userEvent.clear(input);await userEvent.paste(JSON.stringify([{name:'test',text:'body'}]));await userEvent.click(screen.getByRole('button',{name:'檢查並套用 JSON'}));await waitFor(()=>expect(c.askConfirmation).toHaveBeenCalled());expect(c.onImport).not.toHaveBeenCalled();expect(input.value).toContain('test');
});
test('C04 confirmed valid import forwards exact normalized payload',async()=>{
 const c=await mount();const input=screen.getByRole('textbox',{name:'AI 回傳的短句 JSON'});await userEvent.click(input);await userEvent.paste(JSON.stringify([{name:' 名前 ',text:' 本文 ',scenario:' 情境 '}]));await userEvent.click(screen.getByRole('button',{name:'檢查並套用 JSON'}));await waitFor(()=>expect(c.onImport).toHaveBeenCalledWith([{name:'名前',text:'本文',scenario:'情境'}]));expect(input.value).toBe('');
});
