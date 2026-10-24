import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSnippets, prepareSnippetSave, reorderSnippets, parseSnippetImport, savedVersions } from '../src/model.js';
test('keeps Unicode and multiline content while normalizing whitespace', () => {
  assert.deepEqual(validateSnippets([{ name: '  規劃  ', text: '  先理解\n再進行。  ' }]), [{ name: '規劃', text: '先理解\n再進行。' }]);
});
test('saving a valid edit keeps an empty draft out of persisted snippets without losing it', () => {
  const draft = { name: '新短句', text: '' };
  const result = prepareSnippetSave([{ name: ' 已改名 ', text: ' 正文 ' }, draft]);
  assert.deepEqual(result.saved, [{ name: '已改名', text: '正文' }]);
  assert.deepEqual(result.editorItems, [{ name: '已改名', text: '正文' }, draft]);
  assert.equal(result.draftCount, 1);
});
test('partially filled drafts still require content and cannot replace all valid snippets', () => {
  assert.throws(() => prepareSnippetSave([{ name: '自訂草稿', text: '' }]));
  assert.throws(() => prepareSnippetSave([{ name: '新短句', text: '' }]));
});

test('complete snippets save beside incomplete drafts with precise issues and no draft loss', () => {
  const draft={name:'待補正文',text:'',scenario:'保留情境'};
  const noName={name:'',text:'保留內容'};
  const complete={name:'完整',text:'正文'};
  const result=prepareSnippetSave([draft,complete,noName]);
  assert.deepEqual(result.saved,[complete]);
  assert.equal(result.editorItems[0],draft);
  assert.equal(result.editorItems[2],noName);
  assert.deepEqual(result.issues.map(i=>[i.index,i.fields[0].field]),[[0,'text'],[2,'name']]);
});

test('incomplete edits retain their last saved version while other changes persist',()=>{
  const existing={name:'原名',text:'原文',scenario:'時機'};
  const previous=savedVersions([existing]);existing.text='';
  const other={name:'新增完整',text:'新文'};
  const result=prepareSnippetSave([existing,other],previous);
  assert.equal(result.saved[0].text,'原文');
  assert.equal(result.saved[1].text,'新文');
  assert.equal(result.editorItems[0].text,'');assert.equal(result.issues[0].retained,true);
  existing.text='補齊';
  const next=prepareSnippetSave(result.editorItems,result.versions);
  assert.equal(next.saved[0].text,'補齊');assert.equal(next.draftCount,0);
});

test('field limits and missing fields identify the original editor index',()=>{
  const good={name:'有效',text:'正文'};
  const invalid={name:'',text:'',scenario:'x'.repeat(1001)};
  const result=prepareSnippetSave([good,invalid]);
  assert.deepEqual(result.issues[0].fields.map(f=>f.field),['name','text','scenario']);
  assert.equal(result.issues[0].index,1);
  assert.equal(result.editorItems[1],invalid);
  assert.deepEqual(result.saved,[good]);
});
test('reordering preserves selected edit and draft identity across moves in both directions', () => {
  const a = { name: 'A', text: '未儲存的修改' }, b = { name: 'B', text: 'B' }, draft = { name: '新短句', text: '' };
  const first = reorderSnippets([a, b, draft], 2, 0, 0);
  assert.deepEqual(first.items, [draft, a, b]);
  assert.equal(first.selected, 1);
  assert.equal(first.items[first.selected], a);
  const second = reorderSnippets(first.items, 0, 2, first.selected);
  assert.deepEqual(second.items, [a, b, draft]);
  assert.equal(second.selected, 0);
  assert.deepEqual(prepareSnippetSave(first.items).saved.map(s => s.name), ['A', 'B']);
});
test('rejects unusable snippets before saving', () => {
  assert.throws(() => validateSnippets([]));
  assert.throws(() => validateSnippets([{ name: '標題', text: '  ' }]));
  assert.throws(() => validateSnippets([{ name: 'a'.repeat(101), text: '內容' }]));
});
test('AI JSON import accepts a fenced response, preserves newlines and strips unrelated fields', () => {
  assert.deepEqual(parseSnippetImport('```json\n[{"name":" 測試 ","text":"第一行\\n第二行","scenario":"適合測試","unrelated":"不匯入"}]\n```'), [{name:'測試', text:'第一行\n第二行',scenario:'適合測試'}]);
});
test('invalid AI imports are rejected before any persistence', () => {
  for (const input of ['invalid', '{}', '[]', '[{"name":"標題","text":""}]', JSON.stringify(Array.from({length:101},()=>({name:'a',text:'b'})))]) {
    assert.throws(()=>parseSnippetImport(input));
  }
});

test('optional scenarios survive save, import and reorder without changing text',()=>{
 const item={name:'提示',text:'Only paste this.',scenario:'  適合初稿 日本語  '};
 const expected={name:'提示',text:'Only paste this.',scenario:'適合初稿 日本語'};
 assert.deepEqual(prepareSnippetSave([item]).saved,[expected]);
 assert.deepEqual(parseSnippetImport(JSON.stringify([item])),[expected]);
 assert.deepEqual(validateSnippets([{name:'a',text:'b',scenario:''}]),[{name:'a',text:'b',scenario:''}]);
 assert.throws(()=>validateSnippets([{name:'a',text:'b',scenario:42}]));
 assert.throws(()=>validateSnippets([{name:'a',text:'b',scenario:'x'.repeat(1001)}]));
 assert.throws(()=>prepareSnippetSave([{name:'新短句',text:'',scenario:'Important draft context'}]));
});

test('AI import rejects wrong row and field types without coercing user data',()=>{
 const valid={name:'合法',text:'正文',scenario:'使用時機'};
 for(const [value,field] of [[null,'item'],[17,'item'],[[],'item'],[{name:42,text:'正文'},'name'],[{name:'標題',text:{x:1}},'text'],[{name:'標題',text:'正文',scenario:null},'scenario'],[{name:'標題',text:'   '},'text'],[{name:'x'.repeat(101),text:'正文'},'name']]){
  const json=JSON.stringify([valid,value]);
  assert.throws(()=>parseSnippetImport(json),error=>error.code==='error.import_entry'&&error.params.index===2&&error.params.field===field);
  assert.equal(json,JSON.stringify([valid,value]));
 }
 assert.deepEqual(parseSnippetImport(JSON.stringify([valid])),[valid]);
});

test('import errors explain field and row in all four languages',async()=>{
 const {errorMessage,setLanguage}=await import('../src/i18n.js');
 let error;try{parseSnippetImport('[{"name":"ok","text":"body"},{"name":"bad","text":2}]')}catch(e){error=e}
 for(const [language,expected]of [['zh-TW','第 2 筆的 text'],['zh-CN','第 2 项的 text'],['en','Entry 2, text'],['ja','2 件目の text']]){
  setLanguage(language,false);const message=errorMessage(error);assert(message.includes(expected));assert(!message.includes('error.import_'));assert(!message.includes('{'));
 }
 setLanguage('en',false);
});
