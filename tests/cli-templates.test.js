import test from 'node:test';
import assert from 'node:assert/strict';
import {getRoleDefaults,getRoleTranslations} from '../src/roles.js';
import {localizedSnippet} from '../src/localized-snippet.js';

test('personal slots 07 and 08 preserve executable command text in all languages',()=>{
 for(const language of ['zh-TW','zh-CN','en','ja']){
  const defaults=getRoleDefaults('personal',language);
  assert.equal(defaults.length,8);
  assert.deepEqual(defaults.slice(6).map(item=>item.text),[
   'claude --dangerously-skip-permissions',
   'codex --dangerously-bypass-approvals-and-sandbox',
  ]);
  const translated=getRoleTranslations('personal',language);
  assert(translated.slice(6).every(item=>item.scenario.length>0));
  assert.equal(getRoleDefaults('developer',language).length,3);
 }
});

test('custom command snippets remain unchanged when switching languages',()=>{
 const item={name:'My command',text:'codex --dangerously-bypass-approvals-and-sandbox',scenario:'My usage',custom:true};
 for(const language of ['zh-TW','zh-CN','en','ja'])assert.equal(localizedSnippet(item,'personal',language),item);
});
