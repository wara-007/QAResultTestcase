import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project } from './types';
import { readSprintTeamData } from './sprint-team-data';
import { buildTeamProjectReport } from './team-project-report';

const projects=[{id:'p',name:'Payment',sprintId:'s'},{id:'other',name:'Other',sprintId:'next'}] as Project[];
const counts={totalCases:2,pass:1,failed:0,skip:0,inProgress:0,notStart:1,openDefects:0,totalDefects:0,closedDefects:0};
function database(fail=false){
  const calls:{name:string;columns:string}[]=[];
  function query(name:string){
    let columns='',start=0,end=499;const filters:((row:Record<string,unknown>)=>boolean)[]=[];
    const builder={select(value:string){columns=value;return builder;},order(){return builder;},limit(){return builder;},eq(){return builder;},
      in(key:string,values:unknown[]){if(name==='test_cases')filters.push(row=>values.includes(row[key]));return builder;},
      gt(key:string,value:number){filters.push(row=>Number(row[key])>value);return builder;},
      range(a:number,b:number){start=a;end=b;return builder;},
      then(resolve:(value:unknown)=>unknown,reject?:(reason:unknown)=>unknown){
        calls.push({name,columns});
        if(['result_origins','test_case_qa_assignments','project_history','sprint_history','project_sprint_snapshots','source_files'].includes(name))throw Error('Team must not load detail payloads: '+name);
        if(name==='project_sprint_continuation_ready')return Promise.resolve({error:{code:'PGRST202',message:'not installed'},data:null}).then(resolve,reject);
        const rows:Record<string,unknown>[]=name==='projects'?[{id:'p',source_files:[{id:'source',summary:{version:1,sourceId:'source',token:'t',updatedAt:'2026-10-28',importComplete:true,counts}}]}]:name==='test_cases'?[
          {id:'one',project_id:'p',testcase_key:'TC01',case_name:'Pay',source_row:2,test_executions:[{attempt_no:2,status:'Pass',executed_by_name:'Alice',executed_date:'2026-10-24',executed_time:'10:00'},{attempt_no:1,status:'Failed',executed_by_name:'Earlier Tester'}]},
          {id:'two',project_id:'p',testcase_key:'TC02',case_name:'Cancel',source_row:3,test_executions:[{attempt_no:1,status:'Not Start',executed_by_name:'Bob'}]},
          {id:'step',project_id:'p',testcase_key:'TC99',case_name:'Step-only snapshot',source_row:null,test_executions:[{attempt_no:1,status:'Pass',executed_by_name:'Step Tester'}]},
          {id:'elsewhere',project_id:'other',testcase_key:'TC10',case_name:'Other Sprint',source_row:5,test_executions:[]},
        ]:[];
        return Promise.resolve({data:name==='can_manage_sprint'?false:rows.filter(row=>filters.every(filter=>filter(row))).slice(start,end+1),error:fail&&name==='test_cases'?{message:'case read failed'}:null}).then(resolve,reject);
      },
    };return builder;
  }
  return {db:{from:query,rpc:query} as unknown as SupabaseClient,calls};
}

test('team reads register columns only and attributes one case to its latest Test cases tester',async()=>{
  const {db,calls}=database();
  const result=await readSprintTeamData(db,'g','s',projects);
  assert.equal(result.error,'');assert.ok(result.data);
  assert.equal(result.data.personalPerformance.basis,'test-cases');
  assert.equal(result.data.personalPerformance.cases.length,2);
  const report=buildTeamProjectReport(result.data,'g',2026);
  assert.equal(report.people.find(p=>p.name==='Alice')!.projects[0].collaborators.find(p=>p.name==='Alice')!.testedCases,1);
  assert.ok(report.people.some(p=>p.name==='Bob'));
  assert.ok(!report.people.some(p=>['Earlier Tester','Step Tester'].includes(p.name)));
  assert.equal(result.data.projects[0].counts.totalCases,2);
  assert.equal(result.data.projects[0].counts.notStart,1);
  const selections=calls.filter(call=>call.name==='test_cases');
  assert.ok(selections.length>0);
  assert.ok(selections.every(call=>!/(result_reference|stepDefinitions|steps|expected_result|apiResponse|log)/.test(call.columns)));
});

test('failed register reads do not publish an empty or partial team report',async()=>{
  const result=await readSprintTeamData(database(true).db,'g','s',projects);
  assert.equal(result.data,undefined);
  assert.match(result.error,/case read failed/);
});
