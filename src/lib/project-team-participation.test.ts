import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestCase, TestResult, TestCaseStep } from './types';
import { buildProjectTeamParticipation } from './project-team-participation';
const result=(id:string,testerName:string,stepId?:string,createdAt='2026-10-20T10:00:00Z',status:TestResult['status']='Pass'):TestResult=>({id,testerName,stepId,createdAt,status,actualResult:'',apiResponse:'',log:'',evidence:[]});
const item=(id:string,results:TestResult[]=[],stepDefinitions:TestCaseStep[]=[]):TestCase=>({id,name:id,status:'Pass',executedBy:'',results,stepDefinitions} as TestCase);
test('shared case credits each tester once; repeats use latest outcome per person and step',()=>{
 const rows=buildProjectTeamParticipation([item('TC1',[result('a','A','s1'),result('b','B','s2'),result('c','A','s1','2026-10-21T10:00:00Z','Failed')])]);
 assert.equal(rows.length,2); assert.equal(rows[0].cases.length,1);assert.equal(rows[0].stepCount,1);
 assert.equal(rows[0].cases[0].steps[0].status,'Failed');assert.equal(rows[1].stepCount,1);
});
test('case-only results never infer steps; separate internal case ids remain distinct',()=>{
 const rows=buildProjectTeamParticipation([item('one',[result('a','A')]),item('two',[result('b','A')])]);
 assert.equal(rows[0].cases.length,2);assert.equal(rows[0].stepCount,0);assert.equal(rows[0].caseOnlyCount,2);
});
test('step definition tester is supported and deduplicated against mapped results',()=>{
 const step={id:'s1',name:'Step 1',executedBy:'A',status:'Pass',executedDate:''} as TestCaseStep;
 const rows=buildProjectTeamParticipation([item('TC1',[result('a','A','s1')],[step])]);
 assert.equal(rows[0].stepCount,1);assert.equal(rows[0].cases[0].steps[0].name,'Step 1');
});
test('unstarted and anonymous data never invent participation',()=>{
 assert.deepEqual(buildProjectTeamParticipation([item('TC1',[result('a',''),result('b','A',undefined,'','Not Start')])]),[]);
});
test('executed-by custom field is used; case summary adds no step credit',()=>{
 const r={...result('r','', 's1'),customFields:[{key:'tester',label:'Executed By',value:'QA A',column:0}]};
 const c={...item('TC1',[r]),executedBy:'QA B'};
 const rows=buildProjectTeamParticipation([c]);
 assert.equal(rows.find(p=>p.name==='QA A')?.stepCount,1); assert.equal(rows.find(p=>p.name==='QA B')?.caseOnlyCount,1);
});
