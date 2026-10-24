import test from 'node:test';
import assert from 'node:assert/strict';
import { importPreview } from '../src/import-preview.js';

test('import preview states replacement, saved count, first five names and omitted entries',()=>{
 const items=Array.from({length:8},(_,i)=>({name:`名字${i}`,text:'正文'}));
 const before=JSON.stringify(items),message=importPreview(items,3,'en');
 assert(message.includes('3'));assert(message.includes('8'));assert(message.includes('5/8'));
 for(let i=0;i<5;i++)assert(message.includes(`名字${i}`));assert(!message.includes('名字5'));
 assert(message.includes('drafts'));assert(message.includes('not shown'));assert.equal(JSON.stringify(items),before);
});

test('preview safely bounds long multiline names without breaking emoji or changing content',()=>{
 const items=[{name:'😀'.repeat(40)+'\nextra',text:'<script>not rendered</script>'},{name:'<b>Title</b>\nsecond line',text:'unchanged'}];
 const before=JSON.stringify(items),message=importPreview(items,1,'zh-TW');
 assert(message.includes('😀'.repeat(32)+'…'));assert(!message.includes('\ufffd'));assert(message.includes('<b>Title</b> second line'));assert(!message.includes('<script>'));assert.equal(JSON.stringify(items),before);
});

test('preview localizes scope and preserves user names in all four languages',()=>{
 for(const language of ['zh-TW','zh-CN','en','ja']){
  const message=importPreview([{name:'User name 日本語',text:'body'}],2,language);
  assert(message.includes('User name 日本語'));assert(message.includes('1/1'));assert(!message.includes('{'));assert(!message.includes('undefined'));
 }
});
