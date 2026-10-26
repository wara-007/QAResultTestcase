import test from 'node:test';
import assert from 'node:assert/strict';
import { needsCoverSnapshot } from './google-sheet-read-plan';
test('detail batches avoid rereading Cover while summary and initial loads retain it',()=>{
 assert.equal(needsCoverSnapshot({summary:true},'Cover'),true);
 assert.equal(needsCoverSnapshot({},'Cover'),true);
 assert.equal(needsCoverSnapshot({sheetNames:[]},'Cover'),true);
 assert.equal(needsCoverSnapshot({sheetNames:['TC_01','TC_02','TC_03']},'Cover'),false);
 assert.equal(needsCoverSnapshot({testcaseId:'TC_01'},'Cover'),false);
});
test('explicit Cover previews still receive their snapshot',()=>{
 assert.equal(needsCoverSnapshot({sheetName:'Cover'},'Cover'),true);
 assert.equal(needsCoverSnapshot({sheetNames:['Cover','Defect']},'Cover'),true);
 assert.equal(needsCoverSnapshot({sheetName:'Summary'},'Summary'),true);
});
