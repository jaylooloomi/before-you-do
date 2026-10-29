import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
const [binary,output]=process.argv.slice(2);assert(binary&&output,'Expected app executable and report path');
const commands=execFileSync('/usr/bin/otool',['-l',binary],{encoding:'utf8'});
const block=commands.split(/Load command \d+/).find(value=>value.includes('ScreenCaptureKit.framework'));
assert(block&&block.includes('LC_LOAD_WEAK_DYLIB'),'ScreenCaptureKit must be weak-linked to preserve older macOS startup');
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,commands);console.log('Verified weak ScreenCaptureKit linkage; hardware/TCC capture is not exercised.');
