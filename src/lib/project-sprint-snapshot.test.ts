import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotCaseFromStored, validateSnapshotHeader } from './project-sprint-snapshot';
test('snapshot preserves rich stored results without consulting live data',()=>{
  const result={id:'r',status:'Skip',evidence:[{fileId:'file',name:'clip',mimeType:'video/mp4'}],textHighlights:{log:[{start:0,end:3}]},origin:{sprintId:'a'},log:'log'};
  const payload={version:4,results:[result],sourceFields:[{label:'Condition',value:'x',column:1}],stepDefinitions:[{id:'step'}],defects:[{id:'bug',status:'Open'}]};
  const tc=snapshotCaseFromStored({id:'record',testcase_key:'TC01',case_name:'Case',test_executions:[{id:'e',attempt_no:1,status:'Skip',result_reference:`qa-results:${JSON.stringify(payload)}`} ]});
  assert.deepEqual(tc.results?.[0],result);
  assert.equal(tc.sourceFields?.[0].label,'Condition');
  assert.equal(tc.stepDefinitions?.[0].id,'step');
  assert.equal(tc.defects?.[0].id,'bug');
  assert.throws(()=>validateSnapshotHeader({version:2}));
});
