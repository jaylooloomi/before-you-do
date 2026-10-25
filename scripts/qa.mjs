import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const env={...process.env};
if(process.platform==='win32'){
 const inheritedPath=Object.entries(env).find(([key])=>key.toLowerCase()==='path')?.[1]||'';
 for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];
 env.PATH=`${env.SystemRoot}\\System32;C:\\Program Files\\nodejs;${root}\\.tools\\cargo\\bin;${root}\\.tools\\mingw64\\bin;${inheritedPath}`;
 if(fs.existsSync('.tools/rustup')){env.CARGO_HOME=path.join(root,'.tools/cargo');env.RUSTUP_HOME=path.join(root,'.tools/rustup');env.RUSTUP_TOOLCHAIN='stable-x86_64-pc-windows-gnu';}
}
fs.mkdirSync('artifacts/qa',{recursive:true});
const tests=fs.readdirSync('tests').filter(f=>f.endsWith('.test.js')).map(f=>`tests/${f}`);
const cargo=process.platform==='win32'&&fs.existsSync('.tools/cargo/bin/cargo.exe')?path.join(root,'.tools/cargo/bin/cargo.exe'):'cargo';
const steps=[['node',process.execPath,['--test','--experimental-test-coverage',...tests]],['components',process.execPath,['node_modules/vitest/vitest.mjs','run','--coverage']],['rust',cargo,['test','--offline','--locked','--manifest-path','src-tauri/Cargo.toml']],['e2e',process.execPath,['node_modules/@playwright/test/cli.js','test']]];
let failed=false;const results=[];
for(let round=1;round<=2;round++){
 const outputDir=`artifacts/qa/run-${round}`;fs.mkdirSync(outputDir,{recursive:true});env.QA_OUTPUT_DIR=outputDir;
 for(const [name,cmd,args]of steps){console.log(`\nQA round ${round}: ${name}`);const result=spawnSync(cmd,args,{env,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});const output=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(`${outputDir}/${name}.log`,output);process.stdout.write(output);if(result.error)console.error(result.error);results.push({round,name,status:result.status,error:result.error?.message});if(result.status!==0)failed=true;}
 for(const name of fs.readdirSync('artifacts/qa').filter(name=>name.endsWith('.png')))fs.copyFileSync(`artifacts/qa/${name}`,`${outputDir}/${name}`);
}
fs.writeFileSync('artifacts/qa/runs.json',JSON.stringify(results,null,2));
process.exitCode=failed?1:0;
