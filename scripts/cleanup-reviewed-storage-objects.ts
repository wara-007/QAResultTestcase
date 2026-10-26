/** One-off continuation of the reviewed 2026-10-26 cleanup.
 * Dry-run by default. Requires the exact reviewed fingerprint to apply.
 * Includes older uploads explicitly identified in the second approval report.
 */
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {sourceStoragePaths,type CleanupSource} from '../src/lib/source-storage-cleanup';

type StoredObject={path:string;id:string;updated_at:string;metadata:{size:number}};
type Report={fingerprint:string;oldSources:CleanupSource[];orphanObjects:StoredObject[];objects:StoredObject[];deleteBytes:number;totalPhysicalBytes:number};
const expectedFingerprint='fadc9b44418c2b3705545424d0009a79b15c393236f8f231a319154b3a0c459a';
async function main(){
 const report:Report=JSON.parse(await readFile('/tmp/qa-remaining-storage-plan.json','utf8'));
 const fingerprint=createHash('sha256').update(JSON.stringify(report.objects.map(o=>[o.path,o.id,o.updated_at,o.metadata?.size]).sort())).digest('hex');
 if(fingerprint!==expectedFingerprint || report.fingerprint!==fingerprint || report.objects.length!==214 || report.oldSources.length!==20 || report.orphanObjects.length!==83)throw Error('Reviewed cleanup report changed');
 const unique=new Set(report.objects.map(o=>o.path));
 if(unique.size!==214 || report.objects.some(o=>!/^[-a-f0-9]{36}\/[-a-f0-9]{36}\//.test(o.path)||o.path.split('/').some(p=>!p||p==='.'||p==='..')||!o.id||!Number.isSafeInteger(Number(o.metadata.size))||Number(o.metadata.size)<0))throw Error('Invalid reviewed object');
 const apply=process.argv.find(a=>a.startsWith('--apply='))?.slice(8);
 if(apply && apply!==fingerprint)throw Error('Approval fingerprint differs');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(30000)])})}});
 const token=randomUUID();
 const rpc=async(name:string,args:Record<string,unknown>)=>{const r=await db.rpc(name,args);if(r.error||r.data!==true)throw Error(`${name}: ${r.error?.message??'not completed'}`);};
 async function rows(table:string,columns='*'){
  const all:Record<string,unknown>[]=[];
  for(let offset=0;;offset+=100){const r=await db.from(table).select(columns).order('id').range(offset,offset+99);if(r.error)throw Error(`${table}: ${r.error.message}`);all.push(...r.data as unknown as Record<string,unknown>[]);if(r.data!.length<100)return all;}
 }
 const prefixCache=new Map<string,StoredObject[]>();
 async function stored(path:string){
  const prefix=path.slice(0,path.lastIndexOf('/'));
  if(!prefixCache.has(prefix)){
   const items:StoredObject[]=[];
   for(let offset=0;;offset+=1000){const r=await db.storage.from('testcase-source-files').list(prefix,{limit:1000,offset});if(r.error)throw Error(r.error.message);items.push(...r.data.map(o=>({...o,path:`${prefix}/${o.name}`})) as unknown as StoredObject[]);if(r.data.length<1000)break;}
   prefixCache.set(prefix,items);
  }
  return prefixCache.get(prefix)!.find(o=>o.path===path);
 }
 if(apply)await rpc('qa_source_storage_cleanup_begin',{requested_token:token});
 try{
  const sources=await rows('source_files') as unknown as CleanupSource[];
  const references=[];
  for(const table of ['test_cases','test_executions','export_jobs','project_sprint_snapshots','project_sprint_snapshot_cases','project_approval_requests','project_history'])references.push(...await rows(table));
  const serialized=JSON.stringify(references);
  const latest=new Map<string,CleanupSource>();
  for(const source of sources)if(!latest.has(source.project_id)||latest.get(source.project_id)!.version_no<source.version_no)latest.set(source.project_id,source);
  for(const old of report.oldSources){
   const current=sources.find(s=>s.id===old.id);
   if(!current || latest.get(old.project_id)?.id===old.id || current.storage_key!==old.storage_key || Number(current.byte_size)!==Number(old.byte_size) || serialized.includes(old.id) || serialized.includes(old.storage_key))throw Error(`Source no longer eligible: ${old.id}`);
   const paths=sourceStoragePaths(current);
   if(paths.some(path=>!unique.has(path)))throw Error('Source object list incomplete');
   const retained=latest.get(old.project_id)!;
   if(!retained.storage_key||retained.byte_size<=0)throw Error('Latest original is not a retained physical workbook');
   const parts=await Promise.all(sourceStoragePaths(retained).map(stored));
   if(parts.some(p=>!p)||parts.reduce((n,p)=>n+Number(p!.metadata.size),0)!==Number(retained.byte_size))throw Error(`Latest original incomplete: ${old.project_id}`);
  }
  const orphanPaths=new Set(report.orphanObjects.map(o=>o.path));
  const sourcePaths=new Set(report.oldSources.flatMap(sourceStoragePaths));
  if(report.objects.some(o=>orphanPaths.has(o.path)===sourcePaths.has(o.path)))throw Error('Targets are not an exact disjoint union');
  for(const orphan of report.orphanObjects){
   const parentId=orphan.path.split('/')[1];
   if(Date.parse(orphan.updated_at)>=Date.now()-86400000 || sources.some(s=>s.id===parentId || s.storage_key&&(orphan.path===s.storage_key||orphan.path.startsWith(s.storage_key+'/'))) || serialized.includes(orphan.path)||serialized.includes(parentId))throw Error(`Orphan no longer eligible: ${orphan.path}`);
  }
  for(const expected of report.objects){const actual=await stored(expected.path);if(!actual||actual.id!==expected.id||actual.updated_at!==expected.updated_at||Number(actual.metadata.size)!==Number(expected.metadata.size))throw Error(`Object changed: ${expected.path}`);}
  console.log(JSON.stringify({verified:true,fingerprint,oldVersions:20,orphans:83,objects:214,deleteBytes:report.deleteBytes,apply:!!apply}));
  if(!apply)return;
  const directory='/tmp/qa-source-cleanup-second';await mkdir(directory,{recursive:true});
  await writeFile(`${directory}/before.json`,JSON.stringify({report,sources},null,2));
  let deletedBytes=0,deletedObjects=0;
  async function remove(objects:StoredObject[]){
   const wall=Date.now(),monotonic=performance.now();
   await rpc('qa_source_storage_cleanup_renew',{requested_token:token});
   if(Date.now()-wall>60000||performance.now()-monotonic>60000)throw Error('Lease freshness lost; re-inventory required');
   const r=await db.storage.from('testcase-source-files').remove(objects.map(o=>o.path));
   if(r.error||r.data.length!==objects.length)throw Error(`Object deletion did not complete: ${r.error?.message??'count mismatch'}`);
   deletedBytes+=objects.reduce((n,o)=>n+Number(o.metadata.size),0);deletedObjects+=objects.length;
   await writeFile(`${directory}/deleted-${deletedObjects}.json`,JSON.stringify({objects,deletedBytes,deletedObjects,deletedAt:new Date().toISOString()}));
   console.log(JSON.stringify({deletedObjects,deletedBytes}));
  }
  for(const old of report.oldSources){const objects=report.objects.filter(o=>sourceStoragePaths(old).includes(o.path));await remove(objects);await rpc('qa_source_storage_cleanup_finish',{requested_token:token,requested_source:old.id,requested_key:old.storage_key,deleted_bytes:objects.reduce((n,o)=>n+Number(o.metadata.size),0)});}
  await remove(report.orphanObjects);
  await writeFile(`${directory}/result.json`,JSON.stringify({deletedObjects,deletedBytes,oldVersions:20,orphans:83,finishedAt:new Date().toISOString()},null,2));
 } finally {if(apply)await rpc('qa_source_storage_cleanup_end',{requested_token:token});}
}
main().catch(reason=>{console.error(reason instanceof Error?reason.message:String(reason));process.exitCode=1;});
