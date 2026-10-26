import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {roles,getRoleDefaults,findRoleTemplate,roleName} from '../src/roles.js';
import {validateSnippets} from '../src/model.js';

test('role presets have distinct valid localized instructions and stable identifiers',()=>{
 assert.equal(roles.length,13);assert.equal(new Set(roles.map(r=>r.id)).size,13);
 const native=fs.readFileSync(new URL('../src-tauri/src/roles.rs',import.meta.url),'utf8');
 const nativeIds=[...native.slice(native.indexOf('pub const IDS'),native.indexOf('pub fn path')).matchAll(/"([a-z]+)"/g)].map(m=>m[1]);assert.deepEqual(nativeIds,roles.map(r=>r.id));
 for(const language of ['zh-TW','zh-CN','en','ja']){
  const groups=roles.map(role=>getRoleDefaults(role.id,language));
  const embedded=JSON.parse(fs.readFileSync(new URL('../src/role-defaults.json',import.meta.url),'utf8'));
  roles.forEach((role,i)=>assert.deepEqual(embedded[role.id][language],groups[i]));
  groups.forEach((items,i)=>{assert.deepEqual(validateSnippets(items),items);assert(roleName(roles[i].id,language));});
  assert(!groups[2].some(a=>groups[3].some(b=>a.text===b.text)));
  for(const id of roles.map(r=>r.id).filter(id=>!['personal','developer'].includes(id)))for(const item of getRoleDefaults(id,language)){
   assert(findRoleTemplate(item,language)?.scenario);
   assert.equal(findRoleTemplate({...item,text:item.text+' changed'},language),null);
  }
 }
 const first=getRoleDefaults('writer','en');first[0].text='user edit';
 assert.notEqual(getRoleDefaults('writer','en')[0].text,'user edit');
 assert.notEqual(getRoleDefaults('writer','en')[0].text,getRoleDefaults('writer','ja')[0].text);
});
