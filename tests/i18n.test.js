import test from 'node:test';
import assert from 'node:assert/strict';
import { rows } from '../src/locales.js';
import { resolveLanguage, translate } from '../src/i18n.js';
import { getTemplates, findTemplate } from '../src/template-locales.js';
import { prepareSnippetSave } from '../src/model.js';
test('locale selection handles scripts, regions, system fallback and invalid preferences',()=>{
 for(const [system,expected] of [['zh-TW','zh-TW'],['zh-Hant','zh-TW'],['zh-HK','zh-TW'],['zh-Hans-SG','zh-CN'],['ja-JP','ja'],['en-GB','en'],['fr-FR','en']]) assert.equal(resolveLanguage('system',system),expected);
 assert.equal(resolveLanguage('ja','zh-TW'),'ja');
});
test('all translation entries have four nonempty variants and unique keys',()=>{
 assert.equal(new Set(rows.map(row=>row[0])).size,rows.length);
 for(const row of rows){assert.equal(row.length,4); assert(row.every(value=>typeof value==='string'&&value.length));}
 assert.equal(translate('{count} 字','en',{count:76}),'76 characters');
 assert.equal(translate('unknown','ja'),'unknown');
});
test('translated template metadata does not mutate saved snippets and edited bodies lose hints',()=>{
 const original={name:'我的自訂名稱',text:getTemplates('zh-TW')[0].text}; const before=JSON.stringify(original);
 for(const language of ['zh-TW','zh-CN','en','ja']){
  const list=getTemplates(language);assert.equal(list.length,8);assert(list.every(i=>i.name&&i.text&&i.scenario&&i.source));
  assert.equal(findTemplate(original,language).text,list[0].text);
  assert.equal(findTemplate({...original,text:'user edits'},language),undefined);
 }
 assert.equal(JSON.stringify(original),before);
});
test('empty localized drafts are retained in the editor and excluded from saved data',()=>{
 const original={name:'原文',text:'保持原文'};
 for(const name of ['新短句','New snippet','新しい短文']){
  const result=prepareSnippetSave([original,{name,text:''}]);assert.deepEqual(result.saved,[original]);assert.equal(result.editorItems.length,2);
 }
});
