/** Run with Node >=22, --env-file=.env.local --import tsx. Dry-run by default.
 * Apply only after reviewing the JSON report: --apply=<report fingerprint>.
 * Deletes exact superseded object paths; never cases, source metadata rows,
 * Google Sheets, Drive evidence, local uploads, latest or referenced workbooks.
 */
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {planSourceStorageCleanup,sourceStoragePaths,type CleanupSource} from '../src/lib/source-storage-cleanup';
import {readSheetImportState} from '../src/lib/sheet-import-state';
import {approvalEvidenceReadiness} from '../src/lib/approval-evidence';
import {parseStoredResults} from '../src/lib/stored-results';

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(30000)])})}});
async function rows(table:string,columns='*') {
 const result:Record<string,unknown>[]=[];
 for(let offset=0;;offset+=100){const r=await db.from(table).select(columns).order('id').range(offset,offset+99).abortSignal(AbortSignal.timeout(20000));if(r.error)throw Error(`${table}: ${r.error.message}`);result.push(...r.data as unknown as Record<string,unknown>[]);if(r.data!.length<100)return result;}
}
async function inventory() {
 const projects=await rows('projects','id,name,google_sheet_id');
 const sources=await rows('source_files');
 const cases=await rows('test_cases','id,project_id,testcase_key,source_file_id');
 const executions=await rows('test_executions','id,project_id,test_case_id,attempt_no,result_reference');
 const references=[...cases,...await rows('export_jobs'),...await rows('project_sprint_snapshots'),...await rows('project_sprint_snapshot_cases'),...await rows('project_approval_requests'),...await rows('project_history')];
 const verifiedProjectIds:string[]=[];
 for(const project of projects){
  const latest=sources.filter(s=>s.project_id===project.id).sort((a,b)=>Number(b.version_no)-Number(a.version_no))[0];
  const mapping=latest?.column_mapping as Record<string,unknown>|undefined;
  const snapshot=readSheetImportState(mapping?.sheetImport,String(project.google_sheet_id ?? ''));
  const evidenceCases=cases.filter(c=>c.project_id===project.id).map(c=>{
   const latestExecution=executions.filter(e=>e.test_case_id===c.id).sort((a,b)=>Number(b.attempt_no)-Number(a.attempt_no))[0];
   return {id:String(c.testcase_key),results:parseStoredResults(String(latestExecution?.result_reference ?? '')).results};
  });
  const tabs=Array.isArray(mapping?.sheets)?mapping.sheets.map(s=>String(s.name)):undefined;
  let verified=approvalEvidenceReadiness(snapshot,evidenceCases,tabs).ready;
  // Keeping a physically complete latest workbook preserves legacy recovery
  // even for projects whose old importer had no evidence manifest.
  if(!verified && latest?.storage_provider==='supabase' && latest.storage_key){
   try {const objects=await inspectObjects(latest as unknown as CleanupSource);verified=objects.bytes===Number(latest.byte_size);}catch{/* hold the project */}
  }
  if(verified)verifiedProjectIds.push(String(project.id));
 }
 const plan=planSourceStorageCleanup({projects:projects as {id:string;google_sheet_id:string|null}[],sources:sources as unknown as CleanupSource[],references,verifiedProjectIds});
 return {projects,sources,verifiedProjectIds,plan};
}
async function inspectObjects(source:CleanupSource){
 const paths=sourceStoragePaths(source),key=source.storage_key;
 const prefix=paths.length>1 || Number(source.column_mapping?.chunkCount)>0 ? key : key.slice(0,key.lastIndexOf('/'));
 const listed=await db.storage.from('testcase-source-files').list(prefix,{limit:1000});
 if(listed.error)throw Error(listed.error.message);
 const objects=listed.data.filter(item=>paths.includes(`${prefix}/${item.name}`));
 if(paths.length!==objects.length || objects.some(o=>!o.id || !Number.isFinite(Number(o.metadata?.size))))throw Error(`Object inventory mismatch: ${source.id}`);
 return {paths,bytes:objects.reduce((sum,item)=>sum+Number(item.metadata?.size),0)};
}
async function main(){
 const apply=process.argv.find(arg=>arg.startsWith('--apply='))?.slice(8);
 const token=randomUUID();
 if(apply){
  const claim=await db.rpc('qa_source_storage_cleanup_begin',{requested_token:token});
  if(claim.error)throw Error(`Cleanup requires the database write guard migration: ${claim.error.message}`);
 }
 try {
 const data=await inventory();
 const fingerprint=createHash('sha256').update(JSON.stringify(data.plan.eligible.map(s=>[s.id,s.storage_key,s.byte_size,s.column_mapping]).sort())).digest('hex');
 const out=process.env.QA_CLEANUP_REPORT_DIR ?? '/tmp/qa-source-cleanup';await mkdir(out,{recursive:true});
 const report={fingerprint,eligible:data.plan.eligible,retained:data.plan.retained,registeredBytes:data.plan.bytes,verifiedProjects:data.verifiedProjectIds,createdAt:new Date().toISOString()};
 await writeFile(`${out}/plan-${fingerprint}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({eligible:report.eligible.length,registeredBytes:report.registeredBytes,verifiedProjects:report.verifiedProjects.length,fingerprint,report:`${out}/plan-${fingerprint}.json`}));
 if(!apply)return;
 if(apply!==fingerprint)throw Error('Cleanup plan changed; review the new report before applying');
 // Save an audit copy before the first destructive operation.
 await writeFile(`${out}/before-${fingerprint}.json`,JSON.stringify(data.sources));
 let deletedBytes=0,deletedSources=0;
 for(const source of data.plan.eligible){
  const renewedWall=Date.now(),renewedMonotonic=performance.now();
  const renew=await db.rpc('qa_source_storage_cleanup_renew',{requested_token:token});
  if(renew.error)throw Error(`Cannot renew cleanup lease: ${renew.error.message}`);
  const objects=await inspectObjects(source);
  if(Date.now()-renewedWall>60000 || performance.now()-renewedMonotonic>60000)throw Error('Cleanup lease may have expired during a process pause; rebuild inventory');
  const response=await db.storage.from('testcase-source-files').remove(objects.paths);
  if(response.error)throw Error(`Delete ${source.id}: ${response.error.message}`);
  if(response.data.length!==objects.paths.length)throw Error(`Deletion count mismatch: ${source.id}`);
  await writeFile(`${out}/deleted-${source.id}.json`,JSON.stringify({source,objects,response:response.data,deletedAt:new Date().toISOString()}));
  const update=await db.rpc('qa_source_storage_cleanup_finish',{requested_token:token,requested_source:source.id,requested_key:source.storage_key,deleted_bytes:objects.bytes});
  if(update.error || update.data!==true)throw Error(`Deleted objects but could not finalize metadata for ${source.id}; use journal to reconcile`);
  deletedBytes+=objects.bytes;deletedSources++;
  console.log(JSON.stringify({deletedSources,deletedBytes}));
 }
 await writeFile(`${out}/result-${fingerprint}.json`,JSON.stringify({deletedSources,deletedBytes,finishedAt:new Date().toISOString()},null,2));
 } finally {
  if(apply){const release=await db.rpc('qa_source_storage_cleanup_end',{requested_token:token});if(release.error)throw Error(`Could not release cleanup lease: ${release.error.message}`);}
 }
}
main().catch(reason=>{console.error(reason instanceof Error?reason.message:String(reason));process.exitCode=1;});
