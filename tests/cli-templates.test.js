import test from 'node:test';
import assert from 'node:assert/strict';
import {roles,getRoleDefaults,getRoleTranslations} from '../src/roles.js';
import {localizedSnippet} from '../src/localized-snippet.js';

test('agent role sits between personal and development and preserves command text in all languages',()=>{
 assert.deepEqual(roles.slice(0,3).map(role=>role.id),['personal','agent','developer']);
 for(const language of ['zh-TW','zh-CN','en','ja']){
  const defaults=getRoleDefaults('agent',language);
  assert.equal(getRoleDefaults('personal',language).length,6);
  assert.equal(defaults.length,6);
  assert.deepEqual(defaults.map(item=>item.text),[
   'claude --dangerously-skip-permissions',
   'claude --resume',
   '[Shift+Tab]',
   'codex --dangerously-bypass-approvals-and-sandbox',
   'codex resume --all',
   '/permissions',
  ]);
  const translated=getRoleTranslations('agent',language);
  assert(translated.every(item=>item.scenario.length>0));
  assert.equal(getRoleDefaults('developer',language).length,3);
 }
});

test('custom command snippets remain unchanged when switching languages',()=>{
 const item={name:'My command',text:'codex --dangerously-bypass-approvals-and-sandbox',scenario:'My usage',custom:true};
 for(const language of ['zh-TW','zh-CN','en','ja'])assert.equal(localizedSnippet(item,'agent',language),item);
});
