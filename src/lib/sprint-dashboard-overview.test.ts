import assert from 'node:assert/strict';
import test from 'node:test';
import {readSprintDashboardOverview} from './sprint-dashboard-overview';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Project} from './types';
const counts={totalCases:2,pass:1,failed:0,skip:1,inProgress:0,notStart:0,openDefects:0,totalDefects:0,closedDefects:0};
const projects=[{id:'p1',name:'One',sprintId:'s1'},{id:'p2',name:'Two',sprintId:'s1'}] as Project[];
function database(missing=false){
 const calls:string[]=[],selections:string[]=[];
 function query(table:string){
  if(['test_cases','test_executions','test_case_qa_assignments','personal_sprint_cases','result_origins'].includes(table))throw Error('Overview must not load case payloads: '+table);
  const rows=table==='projects'?projects.map(project=>({id:project.id,source_files:missing&&project.id==='p2'?[]:[{id:'source-'+project.id,summary:{version:1,sourceId:'source-'+project.id,token:'token',updatedAt:'2026-10-26T00:00:00Z',importComplete:true,counts},coverSheet:'Cover',coverFields:[{label:'Version',value:'11.1'}],coverCount:999,PRIVATE:'must not escape'}]})):[];
  const builder={select(columns:string){if(table==='projects')selections.push(columns);return builder;},eq(){return builder;},in(){return builder;},or(){return builder;},order(){return builder;},limit(){return builder;},range(){return builder;},
   then(resolve:(value:unknown)=>unknown,reject?:(reason:unknown)=>unknown){calls.push(table);return Promise.resolve({data:table==='can_manage_sprint'?false:rows,error:null}).then(resolve,reject);}};
  return builder;
 }
 return {db:{from:query,rpc:query} as unknown as SupabaseClient,calls,selections};
}
test('overview uses saved counts and Cover fields without reading results, case assignments, or logs',async()=>{
 const {db,calls,selections}=database();const result=await readSprintDashboardOverview(db,'g','s1',projects);
 assert.equal(result.error,'');assert.equal(result.data?.summary.totalCases,4);
 assert.equal(result.data?.projects[0].coverSummary?.fields[0].value,'11.1');
 assert.deepEqual(result.data?.summaryPending,[]);assert.equal(result.data?.loadedDetails,false);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|must not escape/);
 assert.ok(selections.every(columns=>columns.includes('summary:column_mapping->dashboardSummary') && !/(?:^|[,(])column_mapping(?:[,)]|$)/.test(columns)));
 assert.ok(!calls.includes('project_history')&&!calls.includes('sprint_history'));
});
test('a legacy project without a summary remains explicitly unknown rather than a claimed zero',async()=>{
 const {db}=database(true);const result=await readSprintDashboardOverview(db,'g','s1',projects);
 assert.equal(result.error,'');assert.deepEqual(result.data?.summaryPending,['p2']);
 assert.equal(result.data?.projects.find(project=>project.id==='p2')?.dashboardSummary,undefined);
});
