import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {ProjectSummaryConflictError} from './project-dashboard-summary';
const sourceId='11111111-1111-4111-8111-111111111111';
const counts={totalCases:1,pass:1,failed:0,skip:0,inProgress:0,notStart:0,openDefects:0,totalDefects:0,closedDefects:0};
function route(options:{denied?:boolean;latest?:string;conflict?:boolean}={}) {
 const calls:string[]=[];const local=createRequire(import.meta.url);
 class ProjectAccessError extends Error {status=403;}
 const builder={select(){return builder;},eq(){return builder;},order(){return builder;},limit(){return builder;},maybeSingle:async()=>({data:{id:options.latest ?? sourceId},error:null})};
 const compiled=ts.transpileModule(readFileSync(new URL('../app/api/projects/[projectId]/dashboard-summary/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const routeModule={exports:{} as {POST:(request:Request,context:{params:Promise<{projectId:string}>})=>Promise<Response>}};
 runInNewContext(compiled,{exports:routeModule.exports,module:routeModule,Response,Error,crypto,require(id:string){
  if(id==='@/lib/project-access-server')return {ProjectAccessError,requireProjectCapability:async(project:string,capability:string)=>{calls.push(`${project}:${capability}`);if(options.denied)throw new ProjectAccessError('denied');return {supabase:{from:()=>builder}};}};
  if(id==='@/lib/supabase/admin')return {createAdminClient:()=>{calls.push('admin');return {};}};
  if(id==='@/lib/source-mapping-checkpoint')return {updateSourceMapping:async(_db:unknown,project:string,source:string,transform:(mapping:Record<string,unknown>)=>unknown)=>{calls.push(`write:${project}:${source}`);if(options.conflict)throw new ProjectSummaryConflictError('stale');return transform({coverSnapshot:{sheetName:'Cover'}});}};
  return local('./'+id.slice('@/lib/'.length));
 }});
 return {calls,post:(body:unknown)=>routeModule.exports.POST(new Request('http://localhost/api/projects/p/dashboard-summary',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({projectId:'p'})})};
}
test('summary persistence requires edit access before using admin or writing',async()=>{
 const r=route({denied:true});assert.equal((await r.post({sourceId,counts,expectedToken:null})).status,403);assert.deepEqual(r.calls,['p:edit']);
});
test('summary persistence rejects invalid totals, outdated sources, and CAS conflicts',async()=>{
 const invalid=route();assert.equal((await invalid.post({sourceId,counts:{...counts,totalCases:20},expectedToken:null})).status,400);assert.ok(!invalid.calls.includes('admin'));
 const old=route({latest:'other'});assert.equal((await old.post({sourceId,counts,expectedToken:null})).status,409);assert.ok(!old.calls.includes('admin'));
 assert.equal((await route({conflict:true}).post({sourceId,counts,expectedToken:null})).status,409);
});
test('summary endpoint saves only valid compact counts with a server token and timestamp',async()=>{
 const r=route();const response=await r.post({sourceId,counts,expectedToken:null,logs:'ignored'});assert.equal(response.status,200);
 const {summary}=await response.json();assert.deepEqual(summary.counts,counts);assert.equal(summary.sourceId,sourceId);assert.ok(summary.token);assert.ok(Number.isFinite(Date.parse(summary.updatedAt)));assert.equal(summary.logs,undefined);assert.equal(response.headers.get('cache-control'),'no-store');
});
