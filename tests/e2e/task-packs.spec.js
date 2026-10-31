import {test,expect,Manager} from './fixture.js';
async function open(page){await new Manager(page).open();await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes('prompt'));button.click();});await expect(page.locator('#task-pack-select')).toBeVisible();}
async function create(page,name){await page.locator('.task-pack-bar button').click();await page.getByRole('dialog').locator('input').fill(name);await page.getByRole('dialog').locator('button[type=submit]').click();await expect(page.getByRole('dialog')).toHaveCount(0);}
async function add(page,text){await page.evaluate(async()=>{await window.__TAURI_INTERNALS__.invoke('materials_text',{itemId:null,text:''});window.qa.emit('materials-updated',null);});await expect(page.locator('.material-list textarea').last()).toBeVisible();await page.locator('.material-list textarea').last().fill(text);}
test('named task packs save before switch, reject duplicates, cancel and recover crash drafts',async({page})=>{
 await open(page);await add(page,'Synthetic client A brief');
 await create(page,'Demo client B');await expect(page.locator('.material-list textarea')).toHaveCount(0);await add(page,'Synthetic client B draft');
 await page.locator('#task-pack-select').selectOption('legacy');await expect(page.locator('.material-list textarea')).toHaveValue('Synthetic client A brief');
 await create(page,' demo CLIENT b ');await expect(page.locator('.material-status')).toContainText('Task name already exists');await expect(page.locator('#task-pack-select')).toHaveValue('legacy');
 await page.locator('.task-pack-bar button').click();await page.getByRole('dialog').locator('input').fill('Cancelled');await page.getByRole('dialog').locator('button[type=button]').click();expect(await page.locator('#task-pack-select option').count()).toBe(2);
 const b=await page.locator('#task-pack-select option').filter({hasText:'Demo client B'}).getAttribute('value');await page.locator('#task-pack-select').selectOption(b);await expect(page.locator('.material-list textarea')).toHaveValue('Synthetic client B draft');
 // Stop server saves, then reload immediately: scoped local draft must recover for active B.
 await page.evaluate(()=>window.qa.failures.materials_text='Simulated disk failure');await page.locator('.material-list textarea').fill('Recovered B after crash');await page.reload();await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes('prompt')).click();});await expect(page.locator('.material-list textarea')).toHaveValue('Recovered B after crash');
 await page.locator('[data-material=copy]').click();expect(await page.evaluate(()=>window.qa.clipboard)).toContain('Recovered B after crash');
 await page.locator('#task-pack-select').selectOption('legacy');await expect(page.locator('.material-list textarea')).toHaveValue('Synthetic client A brief');await page.locator('#task-pack-select').selectOption(b);await expect(page.locator('.material-list textarea')).toHaveValue('Recovered B after crash');
 await page.locator('[data-material=copy]').click();expect(await page.evaluate(()=>window.qa.clipboard)).toContain('Recovered B after crash');expect(await page.evaluate(()=>window.qa.clipboard)).not.toContain('client A');
 await page.screenshot({path:'artifacts/task-packs-demo.png',fullPage:true});
});
test('failed draft save blocks switching and keeps the original pack selected',async({page})=>{
 await open(page);await add(page,'A');await create(page,'B');const b=await page.locator('#task-pack-select').inputValue();await add(page,'B');await page.evaluate(()=>window.qa.failures.materials_text='Disk full');await page.locator('.material-list textarea').fill('Unsaved B');await page.locator('#task-pack-select').selectOption('legacy');await expect(page.locator('.material-status')).toContainText('Disk full');await expect(page.locator('#task-pack-select')).toHaveValue(b);await expect(page.locator('.material-list textarea')).toHaveValue('Unsaved B');
});
