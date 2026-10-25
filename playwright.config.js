import { defineConfig } from '@playwright/test';
// Playwright's Windows child-tree cleanup needs taskkill, even in a stripped shell PATH.
if(process.platform==='win32')process.env.Path=`${process.env.SystemRoot}\\System32;${process.env.Path||''}`;
const output=process.env.QA_OUTPUT_DIR||'artifacts/qa';
export default defineConfig({
  testDir:'tests/e2e', fullyParallel:false, workers:1, retries:0,
  timeout:45000, expect:{timeout:5000},
  reporter:[['list'],['json',{outputFile:`${output}/e2e-results.json`}],['html',{outputFolder:`${output}/html`,open:'never'}]],
  outputDir:`${output}/e2e`,
  use:{baseURL:'http://127.0.0.1:5187',headless:true,viewport:{width:940,height:820},locale:'zh-TW',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort',url:'http://127.0.0.1:5187',reuseExistingServer:false},
});
