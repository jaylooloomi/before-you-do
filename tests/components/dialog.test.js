import {test,expect} from 'vitest';
import {screen,fireEvent} from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import {askConfirmation} from '../../src/dialog.js';
import {setLanguage} from '../../src/i18n.js';
test('C02 confirmation uses inert text and returns focus after accept',async()=>{
 setLanguage('zh-TW');const origin=document.createElement('button');origin.textContent='來源';document.body.append(origin);origin.focus();const result=askConfirmation({title:'刪除',message:'<script>window.hacked=1</script>'});expect(screen.getByRole('dialog').textContent).toContain('<script>');expect(window.hacked).toBeUndefined();await userEvent.click(screen.getByRole('button',{name:'確認',exact:true}));expect(await result).toBe(true);expect(document.activeElement).toBe(origin);expect(screen.queryByRole('dialog')).toBeNull();
});
test('C02 cancellation and overlapping requests never approve',async()=>{
 const result=askConfirmation({title:'test',message:'test'});expect(await askConfirmation({title:'second',message:'x'})).toBe(false);fireEvent(screen.getByRole('dialog'),new Event('cancel',{cancelable:true}));expect(await result).toBe(false);
});
