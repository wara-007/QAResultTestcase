import assert from 'node:assert/strict';
import test from 'node:test';
import { sprintPersonalMetadata } from './sprint-personal-metadata';
import { personalCasesFromMetadata } from './personal-performance-metadata';
import type { RegisterPerformanceRow } from './personal-register-cases';
const projects=[{id:'p',name:'Project',sprintId:'current'}];
const row=(id:string,results:unknown[]):RegisterPerformanceRow=>({id,project_id:'p',testcase_key:'TC01',case_name:'Case',source_row:2,steps:'',expected_result:'',test_executions:[{attempt_no:1,status:'Pass',executed_by_name:'Register Tester',result_reference:'qa-results:'+JSON.stringify({version:4,results})}]});
const result={id:'r',status:'Pass',createdAt:'2026-10-26',sourceSheetName:'Proof',apiResponse:'PRIVATE API BODY',log:'PRIVATE LOG',evidence:[]};
const origin={test_case_id:'row1',result_id:'r',source_sheet:'Proof',author_id:'qa',author_name:'Named QA',sprint_id:'old',inferred:false,active:true};
test('reuses execution payloads with the same tester and authoritative origin precedence as the SQL metadata reader',()=>{
 const rows=sprintPersonalMetadata([row('row1',[{...result,customFields:[{label:'Executed By',value:'Custom Tester'}]}])],projects,'g',[origin],[]);
 assert.equal(rows[0].results[0].testerName,'Custom Tester');
 assert.equal(rows[0].results[0].authorId,'qa');assert.equal(rows[0].results[0].originSprintId,'old');
 assert.equal(rows[0].current_sprint_id,'current');assert.equal(rows[0].results[0].order,-1);
 assert.doesNotMatch(JSON.stringify(rows),/PRIVATE API BODY|PRIVATE LOG/);
});
test('explicit blank tester stays blank and missing tester uses verified origin before register fallback',()=>{
 const rows=sprintPersonalMetadata([row('row1',[{...result,testerName:''}]),row('row2',[result]),row('row3',[result])],projects,'g',[origin,{...origin,test_case_id:'row2'}],[]);
 assert.equal(rows[0].results[0].testerName,'');assert.equal(rows[1].results[0].testerName,'Named QA');assert.equal(rows[2].results[0].testerName,'Register Tester');
 assert.equal(rows[2].results[0].inferred,true);
});
test('repeated display IDs stay independent and sheet-specific assignments survive without detailed results',()=>{
 const rows=sprintPersonalMetadata([row('row1',[result]),row('row2',[])],projects,'g',[],[{test_case_id:'row2',source_sheet:'Other',user_id:'qa'}]);
 assert.deepEqual(rows.map(r=>r.record_id),['row1','row2']);
 const cases=personalCasesFromMetadata(rows);
 assert.ok(cases.some(c=>c.sourceRowKey==='Other'&&c.assignedUserIds.includes('qa')));
 assert.equal(rows[1].results[0].id,'legacy');
});
test('inactive or nonmatching origin cannot assign an author to another result',()=>{
 const rows=sprintPersonalMetadata([row('row1',[{...result,origin:{authorId:'spoof',inferred:false}}])],projects,'g',[{...origin,active:false},{...origin,source_sheet:'Other'}],[]);
 assert.equal(rows[0].results[0].authorId,undefined);assert.equal(rows[0].results[0].inferred,true);
});
test('a blank first tester field falls back to the recorded tester instead of a later custom field',()=>{
 const rows=sprintPersonalMetadata([row('row1',[{...result,testerName:'Recorded QA',customFields:[{label:'Executed By',value:''},{label:'Tester',value:'Other QA'}]}])],projects,'g',[],[]);
 assert.equal(rows[0].results[0].testerName,'Recorded QA');
});
