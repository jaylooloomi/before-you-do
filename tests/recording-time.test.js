import {test} from 'node:test';import assert from 'node:assert/strict';
import {recordingTime} from '../src/recording-controls.js';
test('recording clock formats elapsed time without wall-clock dates',()=>{assert.equal(recordingTime(-1),'00:00:00');assert.equal(recordingTime(65099),'00:01:05');assert.equal(recordingTime(3661000),'01:01:01');});
