import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSnippetQuery } from '../src/snippet-search.js';

test('search matches all terms across names, bodies and effective scenarios in any order',()=>{
  const item=Object.freeze({name:'AI 開發',text:'請實際測試再回報',scenario:'完成功能後使用'});
  assert(matchesSnippetQuery(item,'回報 AI 功能'));
  assert(matchesSnippetQuery(item,'   測試\n開發\t'));
  assert(!matchesSnippetQuery(item,'AI 行銷'));
  assert(matchesSnippetQuery(item,' 　'));
  assert(matchesSnippetQuery({name:'提示',text:'正文'},'查證','查證來源時'));
  assert(!matchesSnippetQuery({name:'提示',text:'正文',scenario:''},'查證'));
});

test('Unicode matching handles fullwidth text, canonical accents and Japanese kana',()=>{
  for(const [item,query]of [
    [{name:'ＡＩ 測試',text:''},'ai'],
    [{name:'AI test',text:''},'ＡＩ　ＴＥＳＴ'],
    [{name:'Résumé',text:''},'Re\u0301sume\u0301'],
    [{name:'ガイド',text:'テストする'},'ｶﾞｲﾄﾞ ﾃｽﾄ'],
    [{name:'检查',text:'测试并汇报'},'汇报 检查'],
    [{name:'Only C++',text:'Use (x)'},'c++ (x)']
  ])assert(matchesSnippetQuery(item,query),query);
});

test('search leaves original snippets, query and scenario unchanged',()=>{
  const item={name:'ＡＩ',text:'原始\n文字',scenario:'e\u0301'};
  const snapshot=JSON.stringify(item),query='AI é';
  assert(matchesSnippetQuery(Object.freeze(item),query));
  assert.equal(JSON.stringify(item),snapshot);assert.equal(query,'AI é');
});
