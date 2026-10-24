import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSnippets, prepareSnippetSave, reorderSnippets, parseSnippetImport } from '../src/model.js';
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
  assert.deepEqual(parseSnippetImport('```json\n[{"name":" 測試 ","text":"第一行\\n第二行","scenario":"不匯入"}]\n```'), [{name:'測試', text:'第一行\n第二行'}]);
});
test('invalid AI imports are rejected before any persistence', () => {
  for (const input of ['invalid', '{}', '[]', '[{"name":"標題","text":""}]', JSON.stringify(Array.from({length:101},()=>({name:'a',text:'b'})))]) {
    assert.throws(()=>parseSnippetImport(input));
  }
});
