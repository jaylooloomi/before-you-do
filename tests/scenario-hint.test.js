import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarioHint } from '../src/scenario-hint.js';
import { getTemplates } from '../src/template-locales.js';
import { translate } from '../src/i18n.js';

test('built-in and custom scenarios always explain they are excluded from pasted text',()=>{
 for(const language of ['zh-TW','zh-CN','en','ja']){
  const note=translate('僅作為選句提示，不會一起貼入。',language);
  const template=getTemplates(language)[0],before=JSON.stringify(template);
  const hint=scenarioHint(Object.freeze(template),language);
  assert(hint.includes(note));assert(hint.includes(template.source));assert.equal(JSON.stringify(template),before);
  const custom=Object.freeze({source:'自訂來源 <text>',scenario:'不應出現在提示欄的情境正文',text:'真正貼入正文'});
  const customHint=scenarioHint(custom,language);assert(customHint.includes(note));assert(customHint.includes(custom.source));assert(!customHint.includes(custom.text));assert(!customHint.includes(custom.scenario));
  assert.equal(scenarioHint(undefined,language),note);assert.equal(scenarioHint({source:''},language),note);
 }
});
