import test from 'node:test';
import assert from 'node:assert/strict';
import { savedSnapshot } from '../src/saved-snapshot.js';

test('saved baselines remain unchanged while editor drafts and scenarios are modified',()=>{
  const items=[{name:'原名',text:'原文',scenario:'原情境'}];
  const baseline=savedSnapshot(items,true);
  items[0].name='改名';items[0].text='';items[0].scenario='新情境';items.push({name:'草稿',text:''});
  assert.deepEqual(baseline,{exists:true,items:[{name:'原名',text:'原文',scenario:'原情境'}]});
});

test('role caches keep their own baseline instead of adopting a later native reload',()=>{
  const personal=[{name:'自己',text:'已存'}],developer=[{name:'開發',text:'程式'}];
  const cache=new Map([['personal',savedSnapshot(personal,false)],['developer',savedSnapshot(developer,true)]]);
  personal[0].text='未存';developer[0].text='另一草稿';
  const externallyReloaded=[{name:'自己',text:'AI已改檔'}];
  assert.equal(cache.get('personal').items[0].text,'已存');
  assert.notDeepEqual(cache.get('personal').items,externallyReloaded);
  assert.equal(cache.get('developer').items[0].text,'程式');
  assert.equal(cache.get('personal').exists,false);
});
