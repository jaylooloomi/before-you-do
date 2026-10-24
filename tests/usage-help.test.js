import test from 'node:test';
import assert from 'node:assert/strict';
import { usageHelp } from '../src/usage-help.js';

test('usage instructions use the configured modifier and trigger in all four languages',()=>{
  for(const language of ['zh-TW','zh-CN','en','ja']){
    for(const [modifier,key] of [['Alt','H'],['Ctrl + Shift','J'],['Option ⌥','Space']]){
      const help=usageHelp(language,modifier,key);
      assert(help.instruction.includes(modifier));assert(help.instruction.includes(key));
      assert(help.details.includes('Esc'));assert(help.details.includes(key));
      assert(!help.instruction.includes('{'));assert(!help.details.includes('{'));
      assert(help.summary&&help.details);
    }
  }
});

test('instructions explain target focus, cancellation and manager-only dismissal',()=>{
  const help=usageHelp('en','Ctrl','J');
  assert(help.instruction.includes('input field'));assert(help.details.includes('hide'));
  assert(help.details.includes('drafts'));assert(help.details.includes('cancel'));
  assert(!help.instruction.includes('Alt'));assert(!help.details.includes(' H '));
});
