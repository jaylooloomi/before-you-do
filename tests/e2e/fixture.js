import { test as base, expect } from '@playwright/test';
import { installBridge } from './bridge.js';
export const test=base.extend({page:async({page},use,testInfo)=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error.stack||error}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`console.error: ${message.text()}`);});
  await page.addInitScript(installBridge);
  await page.coverage.startJSCoverage({resetOnNavigation:false});
  await use(page);
  const coverage=await page.coverage.stopJSCoverage();
  await testInfo.attach('browser-v8-coverage',{body:JSON.stringify(coverage.filter(entry=>entry.url.includes('/src/'))),contentType:'application/json'});
  await testInfo.attach('console-errors',{body:JSON.stringify(errors,null,2),contentType:'application/json'});
  expect(errors,'Zero console/page errors').toEqual([]);
}});
export {expect};
export class Manager {
  constructor(page){this.page=page;this.name=page.getByRole('textbox',{name:'短句名稱',exact:true});this.text=page.getByRole('textbox',{name:'短句內容',exact:true});this.scenario=page.getByRole('textbox',{name:'適用情境（選填）',exact:true});this.save=page.getByRole('button',{name:'儲存短句',exact:true});}
  async open(){await this.page.goto('/');await expect(this.name).toHaveValue('理解後直接進行');}
  async settings(){await this.page.getByRole('button',{name:'設定與 AI 教學',exact:true}).click();await expect(this.page.getByRole('heading',{name:'設定與 AI 教學'})).toBeVisible();}
  async back(){await this.page.getByRole('button',{name:'返回短句',exact:true}).click();}
}
