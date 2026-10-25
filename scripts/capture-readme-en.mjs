import {spawn} from 'node:child_process';
import {chromium, expect} from '@playwright/test';
import {installBridge} from '../tests/e2e/bridge.js';
import {getRoleDefaults} from '../src/roles.js';

// Isolated browser data and IPC: never attaches to the user's desktop app.
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5191','--strictPort'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let browser;
try {
  await new Promise((resolve,reject)=>{
    server.stdout.on('data',chunk=>{if(chunk.toString().includes('http://127.0.0.1:5191'))resolve();});
    server.stderr.on('data',chunk=>reject(new Error(chunk.toString())));
    server.once('exit',code=>reject(new Error(`Vite exited: ${code}`)));
  });
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1080,height:900},locale:'en-US'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});

  await page.addInitScript(files=>{
    localStorage.setItem('quicksay.language','en');
    localStorage.setItem('quicksay.appearance',JSON.stringify({version:2,theme:'dark',transparency:35}));
    localStorage.setItem('qa.disk',JSON.stringify({role:'personal',files,shortcut:{modifier:'alt',key:'H'}}));
  },{personal:getRoleDefaults('personal','en')});
  await page.addInitScript(installBridge);
  await page.goto('http://127.0.0.1:5191');
  await page.evaluate(files=>{qa.state.files=files;localStorage.setItem('qa.disk',JSON.stringify(qa.state));},{personal:getRoleDefaults('personal','en')});
  await page.reload();
  await expect(page.getByRole('textbox',{name:'Snippet name',exact:true})).toHaveValue(getRoleDefaults('personal','en')[0].name);
  await expect(page.getByRole('textbox',{name:'Snippet text',exact:true})).toHaveValue(getRoleDefaults('personal','en')[0].text);
  await expect(page.getByRole('button',{name:'Save snippets',exact:true})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'docs/images/manager-roles-en.png'});
  expect(errors).toEqual([]);
  console.log('Captured English manager with isolated built-in snippets; zero console/page errors.');
} finally {
  await browser?.close();
  server.kill();
}

