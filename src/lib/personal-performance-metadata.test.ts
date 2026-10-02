import assert from 'node:assert/strict';
import test from 'node:test';
import { personalCasesFromMetadata } from './personal-performance-metadata';

test('metadata adapter keeps source rows separate and constructs source-specific detail links',()=>{
  const cases=personalCasesFromMetadata([{record_id:'record',project_id:'p',project_name:'Project',group_id:'g',current_sprint_id:'s',testcase_key:'TC-18',case_name:'Case',results:[{id:'a',testerName:'A',sourceSheet:'RC TC-18',status:'Pass'},{id:'b',testerName:'B',sourceSheet:'RC TC-18 broken',status:'Failed'}],assignments:[{sourceSheet:'RC TC-18 broken',userId:'b'}]}]);
  assert.equal(cases.length,2);
  assert.equal(cases[0].detailPath,'/groups/g/projects/p/sheets/RC%20TC-18');
  assert.deepEqual(cases[1].assignedUserIds,['b']);
});
test('empty case creates an unstarted base row without inventing an author',()=>{
  const cases=personalCasesFromMetadata([{record_id:'r',project_id:'p',project_name:'P',group_id:'g',current_sprint_id:'s',testcase_key:'TC-01',case_name:'C',results:[],assignments:[]}]);
  assert.equal(cases.length,1);assert.deepEqual(cases[0].results,[]);assert.equal(cases[0].sourceRowKey,'');
});
test('untrusted payload author IDs do not override a different tester name',()=>{
  const cases=personalCasesFromMetadata([{record_id:'r',project_id:'p',project_name:'P',group_id:'g',current_sprint_id:'s',testcase_key:'TC-01',case_name:'C',results:[{id:'a',testerName:'Someone else',authorName:'Recorder',authorId:'recorder',status:'Pass',inferred:false}],assignments:[]}]);
  assert.equal(cases[0].results[0].testerId,undefined);
});
