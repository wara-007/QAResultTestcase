import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotPage, matchingSnapshotHeader } from './project-sprint-history';
test('history lookup rejects mismatched project or sprint and caps pagination',()=>{
  const h={version:1,project:{id:'p'},participation:{id:'e',projectId:'p',sprintId:'s',snapshotKind:'legacy-summary'},counts:{},qa:[],approval:{}};
  assert.equal(matchingSnapshotHeader(h,{projectId:'p',sprintId:'s',participationId:'e'}).participation.snapshotKind,'legacy-summary');
  for(const change of [{projectId:'other'},{sprintId:'other'},{participationId:'other'}]) assert.throws(()=>matchingSnapshotHeader(h,{projectId:'p',sprintId:'s',participationId:'e',...change}));
  assert.deepEqual(snapshotPage(),{offset:0,limit:10});
  assert.deepEqual(snapshotPage(10,100),{offset:10,limit:50});
  assert.throws(()=>snapshotPage(-1));assert.throws(()=>snapshotPage(NaN));
});
