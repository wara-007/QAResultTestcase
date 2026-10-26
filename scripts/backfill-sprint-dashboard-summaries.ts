/** One-time derived-cache backfill. Dry-run by default; never contacts Google/Storage. */
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readAllRows} from '../src/lib/paged-rows';
import {snapshotCaseFromStored,type StoredCaseInput} from '../src/lib/project-sprint-snapshot';
import {buildProjectDashboardCounts,mergeProjectDashboardSummary,readProjectDashboardSummary,type ProjectDashboardSummary} from '../src/lib/project-dashboard-summary';
import {updateSourceMapping} from '../src/lib/source-mapping-checkpoint';
import {readSheetImportState} from '../src/lib/sheet-import-state';
import type {WorkbookSheet} from '../src/lib/types';
const scopes=[
 {group:'b5451207-986a-4ca6-88c0-8eda1e8d3972',sprint:'12fd29e3-6aed-40e4-97e4-c0a5b7a56820'},
 {group:'0eb8b839-1dfe-48c5-8cb9-514062ed12a7',sprint:'82cb2e99-dc82-4c82-93a1-037b9618b920'},
];
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const apply=process.argv.includes('--apply');
 for(const scope of scopes){
  const projects=await db.from('projects').select('id').eq('group_id',scope.group).eq('sprint_id',scope.sprint).order('id');
  if(projects.error)throw Error(projects.error.message);
  for(const project of projects.data ?? []){
   const source=await db.from('source_files').select('id,column_mapping').eq('project_id',project.id).order('version_no',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
   if(source.error)throw Error(source.error.message);
   if(!source.data){console.log(JSON.stringify({projectId:project.id,skipped:'no-source'}));continue;}
   const original=readProjectDashboardSummary(source.data.column_mapping?.dashboardSummary,source.data.id);
   const rows=await readAllRows<StoredCaseInput>((a,b)=>db.from('test_cases').select('id,testcase_key,source_row,steps,expected_result,test_executions(attempt_no,status,result_reference)').eq('project_id',project.id).order('id').order('attempt_no',{referencedTable:'test_executions',ascending:false}).limit(1,{referencedTable:'test_executions'}).range(a,b),10,{shrinkOnTimeout:true});
   const mapping=source.data.column_mapping ?? {};
   const counts=buildProjectDashboardCounts(rows.map(snapshotCaseFromStored),(mapping.sheets ?? []) as WorkbookSheet[]);
   if(apply){
    const latest=await db.from('source_files').select('id').eq('project_id',project.id).order('version_no',{ascending:false}).order('id',{ascending:false}).limit(1).single();
    if(latest.error || latest.data?.id!==source.data.id)throw Error('Source changed during backfill');
    await updateSourceMapping(db,project.id,source.data.id,current=>{
     const state=readSheetImportState(current.sheetImport);
     const summary:ProjectDashboardSummary={version:1,sourceId:source.data!.id,token:randomUUID(),updatedAt:new Date().toISOString(),counts,importComplete:state?.complete===true&&!state.refreshRequired,...(state?.sourceRevision?{sourceRevision:state.sourceRevision}:{})};
     return mergeProjectDashboardSummary(current,summary,original?.token ?? null);
    });
   }
   console.log(JSON.stringify({projectId:project.id,mode:apply?'saved':'dry-run',counts}));
  }
 }
}
void main().catch(reason=>{console.error(reason instanceof Error?reason.message:'backfill failed');process.exitCode=1;});
