import {test,expect,vi} from 'vitest';
import {screen,fireEvent} from '@testing-library/dom';
import {mountCaptureToast} from '../../src/capture-toast.js';
test('preview waits for decoded image, replaces latest capture, and closes without focus',async()=>{
 document.body.innerHTML='<div id="app"></div>';let handler;const invoke=vi.fn(async()=>{});
 await mountCaptureToast(document.getElementById('app'),{invoke,listen:async(name,fn)=>{expect(name).toBe('capture-preview');handler=fn;}});
 const image=screen.getByRole('img',{name:'Screenshot preview'});
 handler({payload:{generation:1,image:'data:image/png;base64,AA=='}});expect(invoke).not.toHaveBeenCalled();const stale=image.onload;
 handler({payload:{generation:2,image:'data:image/png;base64,AQ=='}});stale();expect(invoke).not.toHaveBeenCalled();fireEvent.load(image);expect(invoke).toHaveBeenCalledWith('capture_toast_ready',{generation:2});
 fireEvent.click(screen.getByRole('button',{name:'Close preview'}));expect(invoke).toHaveBeenCalledWith('capture_toast_hide');expect(document.activeElement).not.toBe(image);
});
