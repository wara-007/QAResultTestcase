import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import type {Project} from './types';

const projects=[{id:'p1',name:'Current',sprintId:'s1'},{id:'p2',name:'Moved',sprintId:'s2'}] as Project[];
const origin={project_id:'p2',test_case_id:'moved-row',result_id:'moved-result',source_sheet:'Proof',sprint_id:'s1',author_id:'qa',author_name:'Tester',inferred:false,recorded_at:'2026-10-26',active:true,status:'Pass'};
const execution=(id:string)=>({attempt_no:1,status:'Pass',executed_by_name:'Tester',result_reference:'qa-results:'+JSON.stringify({version:4,results:[{id,status:'Pass',testerName:'Tester',source:'web',sourceSheetName:'Proof',createdAt:'2026-10-26',apiResponse:'PRIVATE',log:'PRIVATE',evidence:[]}]}),executed_date:'',executed_time:''});
const caseRows=[{id:'current-row',project_id:'p1',testcase_key:'TC01',case_name:'Current Case',source_row:2,steps:'',expected_result:'',test_executions:[execution('current-result')]},{id:'moved-row',project_id:'p2',testcase_key:'TC02',case_name:'Moved Case',source_row:2,steps:'',expected_result:'',test_executions:[execution('moved-result')]}];

test('dashboard reuses current and moved execution payloads without the heavy metadata RPC',async()=>{
 const calls:string[]=[];
 const tables:Record<string,Record<string,unknown>[]>= {test_cases:caseRows,result_origins:[origin],test_case_qa_assignments:[{test_case_id:'moved-row',source_sheet:'Proof',user_id:'qa'}],source_files:[{column_mapping:{sheets:[]}}]};
 function query(name:string){
  const filters:((row:Record<string,unknown>)=>boolean)[]=[];let from=0,to=1000;
  const builder={select(){return builder;},order(){return builder;},limit(){return builder;},or(){return builder;},
   eq(key:string,value:unknown){if(name==='test_cases'&&key==='projects.sprint_id')filters.push(row=>projects.find(p=>p.id===row.project_id)?.sprintId===value);return builder;},
   in(key:string,values:unknown[]){if(name==='test_cases'&&key==='id')filters.push(row=>values.includes(row.id));return builder;},
   range(a:number,b:number){from=a;to=b;return builder;},
   then(resolve:(result:unknown)=>unknown,reject?:(reason:unknown)=>unknown){calls.push(name);if(name==='personal_sprint_cases')return Promise.reject(Error('must not call metadata RPC')).then(resolve,reject);return Promise.resolve({data:name==='can_manage_sprint'?false:(tables[name]??[]).filter(row=>filters.every(filter=>filter(row))).slice(from,to+1),error:null}).then(resolve,reject);},
  };return builder;
 }
 const db={from:query,rpc:query};
 const compiled=ts.transpileModule(readFileSync(new URL('./planning-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=createRequire(import.meta.url);
 const loaded={exports:{} as typeof import('./planning-server')};
 runInNewContext(compiled,{exports:loaded.exports,module:loaded,Error,Map,Set,Promise,require(id:string){
  if(id==='server-only')return {};
  if(id==='@/lib/supabase/server')return {createClient:async()=>db};
  if(id==='./project-sprint-history-server')return {loadSprintParticipationHeaders:async()=>({episodes:[],headers:[]}),loadSprintSnapshotPerformance:async()=>({archived:[],baseline:[]})};
  return localRequire(id);
 }});
 const result=await loaded.exports.loadSprintDashboard('g','s1',projects);
 assert.equal(result.error,'');assert.equal(result.data?.summary.totalCases,1);
 assert.ok(!calls.includes('personal_sprint_cases'));
 const moved=result.data?.personalPerformance.cases.find(item=>item.projectId==='p2');
 assert.equal(moved?.results[0].originSprintId,'s1');assert.equal(moved?.assignedUserIds[0],'qa');
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
