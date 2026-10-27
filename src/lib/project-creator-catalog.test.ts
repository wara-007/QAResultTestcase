import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function catalog(options:{catalogError?:boolean;profileError?:boolean}={}){
 let adminCalls=0;const ownerIds:string[][]=[];
 const row={id:'visible',owner_id:'creator',name:'Project',description:'',sprint_no:'1',environment:'UAT',google_sheet_id:null,google_sheet_url:null,created_at:'',updated_at:''};
 const query={select(){return query;},eq(){return query;},order(){return Promise.resolve({data:[row],error:options.catalogError?{message:'denied'}:null});}};
 const db={from:()=>query,auth:{getUser:async()=>({data:{user:{id:'viewer',email:'viewer@example.com',user_metadata:{}}}})},rpc:async(name:string)=>({data:name==='list_project_access'?[{project_id:'visible',can_view:true,can_edit:false,can_manage:false,can_delete:false}]:false,error:null})};
 const local=createRequire(import.meta.url),serverModule={exports:{} as typeof import('./projects-server')};
 const compiled=ts.transpileModule(readFileSync(new URL('./projects-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(compiled,{exports:serverModule.exports,module:serverModule,Map,Error,require(id:string){
  if(id==='server-only')return {};
  if(id==='@/lib/supabase/config')return {hasValidSupabasePublicConfig:()=>true};
  if(id==='@/lib/supabase/server')return {createClient:async()=>db};
  if(id==='./supabase/admin')return {createAdminClient:()=>{adminCalls++;if(options.profileError)throw Error('unavailable');return {from:()=>({select:(columns:string)=>{assert.equal(columns,'id,display_name');return {in:async(_field:string,ids:string[])=>{ownerIds.push([...ids]);return {data:[{id:'creator',display_name:'Creator QA'}],error:null};}};}})};}};
  return local(id.startsWith('@/lib/')?'./'+id.slice('@/lib/'.length):id);
 }});
 return {load:()=>serverModule.exports.loadProjects('group'),adminCalls:()=>adminCalls,ownerIds};
}
test('catalog adds creator labels only after the visible project lookup succeeds and keeps access unchanged',async()=>{
 const c=catalog(),result=await c.load();assert.equal(result.error,'');assert.equal(result.projects[0].ownerId,'creator');assert.equal(result.projects[0].ownerName,'Creator QA');
 assert.equal(result.projects[0].canEdit,false);assert.deepEqual(c.ownerIds,[['creator']]);
 const denied=catalog({catalogError:true});assert.equal((await denied.load()).projects.length,0);assert.equal(denied.adminCalls(),0);
});
test('optional creator name service failure does not break the project catalog',async()=>{
 const result=await catalog({profileError:true}).load();assert.equal(result.error,'');assert.equal(result.projects.length,1);assert.equal(result.projects[0].ownerId,'creator');
});
