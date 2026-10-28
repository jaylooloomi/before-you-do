import test from 'node:test';
import assert from 'node:assert/strict';
import {managerNavigation,nextVisibleSnippet} from '../src/manager-navigation.js';
test('manager arrows map to roles and snippets, leaving native editing and modifiers alone',()=>{
 for(const [key,kind,delta]of [['ArrowLeft','role',-1],['ArrowRight','role',1],['ArrowUp','snippet',-1],['ArrowDown','snippet',1]]){
  assert.deepEqual(managerNavigation({key}),{kind,delta});
  assert.equal(managerNavigation({key},true),null);
  for(const guard of ['defaultPrevented','isComposing','altKey','ctrlKey','metaKey','shiftKey'])assert.equal(managerNavigation({key,[guard]:true}),null);
  assert.equal(managerNavigation({key,keyCode:229}),null);
  assert.equal(managerNavigation({key,target:{isContentEditable:true}}),null);
  assert.equal(managerNavigation({key,target:{closest:()=>({})}}),null);
 }
 assert.equal(managerNavigation({key:'Home'}),null);
});
test('visible snippet navigation wraps without changing order and handles empty results',()=>{
 const indices=[1,3,5];
 assert.equal(nextVisibleSnippet(indices,1,1),3);
 assert.equal(nextVisibleSnippet(indices,5,1),1);
 assert.equal(nextVisibleSnippet(indices,1,-1),5);
 assert.equal(nextVisibleSnippet(indices,0,1),1);
 assert.equal(nextVisibleSnippet(indices,0,-1),5);
 assert.equal(nextVisibleSnippet([],0,1),null);
 assert.deepEqual(indices,[1,3,5]);
});
