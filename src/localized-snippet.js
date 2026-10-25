import {getRoleTranslations} from './roles.js';
// Full signature only: never infer ownership from body text or list position alone.
// Explicit custom ownership or any differing scenario protects user content.
export function localizedSnippet(item,role,language){
 if(!item||item.custom===true)return item;
 for(const source of ['zh-TW','zh-CN','en','ja']){
  const index=getRoleTranslations(role,source).findIndex(template=>template.name===item.name&&template.text===item.text&&(!Object.hasOwn(item,'scenario')||item.scenario===template.scenario));
  if(index>=0){const translated=getRoleTranslations(role,language)[index];return {...item,name:translated.name,text:translated.text,...(Object.hasOwn(item,'scenario')?{scenario:translated.scenario}:{})};}
 }
 return item;
}
