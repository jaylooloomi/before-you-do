import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordedShortcut,normalizeCaptureShortcut,captureShortcutIssues,snippetShortcutFromBinding} from '../src/capture-shortcut-recorder.js';
test('snippet recorder preserves the supported modifier and Space choices',()=>{
 assert.deepEqual(snippetShortcutFromBinding('Alt+J'),{modifier:'alt',key:'J'});
 assert.deepEqual(snippetShortcutFromBinding('Ctrl+Shift+Space'),{modifier:'ctrlShift',key:'Space'});
 assert.equal(recordedShortcut({key:' ',code:'Space',altKey:true},{allowSpace:true}),'Alt+SPACE');
 for(const value of ['','Ctrl+V','Alt+Ctrl+J','Shift+J','Alt+F8','J'])assert.equal(snippetShortcutFromBinding(value),null);
});
test('normalizes duplicates and permits empty disabled bindings while rejecting reserved and invalid keys',()=>{
 assert.equal(normalizeCaptureShortcut(' shift + alt + j '),'Alt+Shift+J');
 assert.equal(normalizeCaptureShortcut(''), '');
 for(const value of ['Ctrl+V','J','Shift+J','Alt+Alt+J','F2','Alt+J+L'])assert.equal(normalizeCaptureShortcut(value),null);
 assert.deepEqual(captureShortcutIssues({gif:'Alt+L',text:'alt+l',file:'',region:'Alt+H'},'Alt+H'),{gif:{type:'duplicate',binding:'Alt+L',others:['text']},text:{type:'duplicate',binding:'Alt+L',others:['gif']},region:{type:'duplicate',binding:'Alt+H',others:['snippet']}});
});
test('records modified letters, physical Option keys, numbers and existing function keys',()=>{
 assert.equal(recordedShortcut({key:'j',code:'KeyJ',altKey:true}),'Alt+J');
 assert.equal(recordedShortcut({key:'∆',code:'KeyJ',altKey:true}),'Alt+J');
 assert.equal(recordedShortcut({key:'1',code:'Digit1',ctrlKey:true,shiftKey:true}),'Ctrl+Shift+1');
 assert.equal(recordedShortcut({key:'F9',ctrlKey:true,shiftKey:true}),'Ctrl+Shift+F9');
 assert.equal(recordedShortcut({key:'PrintScreen'}),'PrintScreen');
 for(const event of [{key:'j'},{key:'J',shiftKey:true},{key:'Alt',altKey:true},{key:'j',altKey:true,repeat:true},{key:'j',altKey:true,isComposing:true},{key:'j',metaKey:true}])assert.equal(recordedShortcut(event),null);
});

test('PrintScreen code survives unidentified key names and preserves Alt',()=>{assert.equal(recordedShortcut({key:'Unidentified',code:'PrintScreen',altKey:true}),'Alt+PrintScreen');assert.equal(recordedShortcut({key:'PrintScreen',code:'PrintScreen',ctrlKey:true,shiftKey:true}),'Ctrl+Shift+PrintScreen');});
