import fs from 'node:fs';
const rounds=[];
function specs(suite){return [...(suite.specs||[]),...(suite.suites||[]).flatMap(specs)];}
for(const round of [1,2]){
 const report=JSON.parse(fs.readFileSync(`artifacts/qa/run-${round}/e2e-results.json`,'utf8'));
 const all=report.suites.flatMap(specs);const errors=[];const modules=new Set();
 for(const spec of all)for(const test of spec.tests)for(const result of test.results)for(const attachment of result.attachments||[]){
  if(attachment.name==='console-errors')errors.push(...JSON.parse(Buffer.from(attachment.body,'base64').toString()));
  if(attachment.name==='browser-v8-coverage')for(const entry of JSON.parse(Buffer.from(attachment.body,'base64').toString()))modules.add(new URL(entry.url).pathname);
 }
 const views=['manager.spec.js','settings.spec.js','picker.spec.js'].filter(file=>report.suites.some(suite=>suite.file?.endsWith(file)));
 rounds.push({round,...report.stats,viewCoverage:`${views.length}/3`,consoleErrors:errors,browserInstrumentedModules:[...modules].sort()});
 if(report.stats.unexpected||report.stats.flaky||errors.length)throw new Error(`Regression run ${round} did not pass`);
}
const matrix=fs.readFileSync('TEST_MATRIX.md','utf8');
if(/^- \[ \]/m.test(matrix))throw new Error('Matrix contains unprocessed cases');
fs.writeFileSync('artifacts/qa/audit.json',JSON.stringify(rounds,null,2));console.log(JSON.stringify(rounds.map(({browserInstrumentedModules,...row})=>({...row,instrumentedModuleCount:browserInstrumentedModules.length})),null,2));
