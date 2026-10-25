import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSnippetImport,prepareSnippetSave,snippetIssues} from '../src/model.js';
test('B06 native-valid 100-codepoint emoji name satisfies frontend contract',()=>{
 const items=[{name:'😀'.repeat(100),text:'正文',scenario:'情境'}];
 assert.deepEqual(parseSnippetImport(JSON.stringify(items)),items);
});
test('B06 all three fields enforce Unicode scalar limits through import and editor saves',()=>{
 for(const [field,limit]of [['name',100],['text',20000],['scenario',1000]]){
  const item={name:'name',text:'body',scenario:''};item[field]='😀'.repeat(limit);
  assert.deepEqual(parseSnippetImport(JSON.stringify([item])),[item]);
  assert.deepEqual(prepareSnippetSave([item]).saved,[item]);
  item[field]+='😀';assert.throws(()=>parseSnippetImport(JSON.stringify([item])));
  assert.equal(snippetIssues(item)[0].field,field);
 }
});
