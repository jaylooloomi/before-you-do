import test from 'node:test';
import assert from 'node:assert/strict';
import {localizedSnippet} from '../src/localized-snippet.js';
import {roles,getRoleDefaults} from '../src/roles.js';
import {getRoleTranslations} from '../src/roles.js';
import {prepareSnippetSave,parseSnippetImport} from '../src/model.js';
test('pristine built-ins project to all four languages for every role without mutating storage',()=>{
 for(const {id}of roles)for(const source of ['zh-TW','zh-CN','en','ja']){
  for(const [index,item]of getRoleDefaults(id,source).entries()){
   const original=structuredClone(item);Object.freeze(item);
   for(const target of ['zh-TW','zh-CN','en','ja'])assert.deepEqual(localizedSnippet(item,id,target),getRoleDefaults(id,target)[index]);
   assert.deepEqual(item,original);
  }
 }
});
test('custom names, bodies, scenarios, explicit empty scenarios and additions stay exact',()=>{
 const builtin=getRoleDefaults('personal','zh-TW')[0];
 for(const item of [{...builtin,name:'我的名稱'},{...builtin,text:'我的正文'},{...builtin,scenario:'自己的情境'},{...builtin,scenario:''},{...getRoleTranslations('personal','zh-TW')[0],custom:true},{name:'新短句',text:''}]){
  const before=JSON.stringify(item);for(const language of ['zh-TW','zh-CN','en','ja'])assert.equal(localizedSnippet(item,'personal',language),item);assert.equal(JSON.stringify(item),before);
 }
});
test('legacy built-ins with their original usage scenarios also follow language changes',()=>{
 for(const {id}of roles){const item=getRoleTranslations(id,'zh-TW')[0];assert.deepEqual(localizedSnippet(item,id,'en'),getRoleTranslations(id,'en')[0]);}
});
test('custom ownership survives save and JSON round trips even for an exact built-in copy',()=>{
 const item={...getRoleTranslations('personal','zh-TW')[0],custom:true};
 const saved=prepareSnippetSave([item]).saved[0];
 const restored=parseSnippetImport(JSON.stringify([saved]))[0];
 assert.deepEqual(restored,item);assert.equal(localizedSnippet(restored,'personal','en'),restored);
});
