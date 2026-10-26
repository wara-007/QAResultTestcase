import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function sessionModule({role={data:'qa',error:null},legacy={data:false,error:null},po={data:null,error:null},claims={data:{claims:{sub:'user',email:'qa@example.com',user_metadata:{password_configured:true}}},error:null}}:{role?:unknown;legacy?:unknown;po?:unknown;claims?:unknown}={}){
 const calls:string[]=[];
 const rpc=(name:string)=>{calls.push(name);const response=name==='get_my_app_role'?role:legacy;return {abortSignal(){return this;},then(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown){return (response instanceof Error?Promise.reject(response):Promise.resolve(response)).then(resolve,reject);}};};
 const db={rpc,auth:{getClaims:async()=>claims}};
 const query={select(){calls.push('po lookup');return query;},eq(){return query;},neq(){return query;},limit(){return query;},abortSignal(){return query;},maybeSingle:async()=>po};
 const localRequire=createRequire(import.meta.url);
 const compiled=ts.transpileModule(readFileSync(new URL('./app-session.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const serverModule={exports:{} as typeof import('./app-session')};
 runInNewContext(compiled,{exports:serverModule.exports,module:serverModule,Error,AbortSignal,require(id:string){if(id==='server-only')return {};if(id==='@/lib/supabase/server')return {createClient:async()=>db};if(id==='@/lib/supabase/admin')return {createAdminClient:()=>({from:()=>query})};if(id==='@/lib/access-flow')return localRequire('./access-flow');return localRequire(id);}});
 return {...serverModule.exports,calls,db};
}
test('approved QA resolves immediately without fallback permission lookups',async()=>{
 const session=sessionModule();assert.equal(await session.resolveAppRole(session.db as never,'qa@example.com'),'qa');assert.deepEqual(session.calls,['get_my_app_role']);
});
test('a successful null role is genuine pending access, with no fallback that could grant access',async()=>{
 const session=sessionModule({role:{data:null,error:null},legacy:{data:true,error:null},po:{data:{id:'invitation'},error:null}});
 assert.equal(await session.resolveAppRole(session.db as never,'qa@example.com'),null);assert.deepEqual(session.calls,['get_my_app_role']);
});
for(const error of [{code:'57014',message:'canceling statement due to statement timeout'},{code:'PGRST002',message:'database unavailable'}])test(`role lookup ${error.code} is unavailable rather than pending or authorized`,async()=>{
 const session=sessionModule({role:{data:null,error},legacy:{data:true,error:null},po:{data:{id:'invitation'},error:null}});
 await assert.rejects(session.resolveAppRole(session.db as never,'qa@example.com'),/ตรวจสอบสิทธิ์/);assert.deepEqual(session.calls,['get_my_app_role']);
});
test('missing role migration still supports a verified legacy QA authorization',async()=>{
 const session=sessionModule({role:{data:null,error:{code:'PGRST202',message:'function missing'}},legacy:{data:true,error:null}});
 assert.equal(await session.resolveAppRole(session.db as never,'qa@example.com'),'qa');
});
test('legacy authorization outage must not turn into a PO fallback',async()=>{
 const session=sessionModule({role:{data:null,error:{code:'42883',message:'function missing'}},legacy:{data:null,error:{code:'57014',message:'timeout'}},po:{data:{id:'invitation'},error:null}});
 await assert.rejects(session.resolveAppRole(session.db as never,'qa@example.com'),/ตรวจสอบสิทธิ์/);assert.ok(!session.calls.includes('po lookup'));
});
test('failure reading a legacy PO invitation cannot mean unapproved user',async()=>{
 const session=sessionModule({role:{data:null,error:{code:'42883',message:'function missing'}},po:{data:null,error:{message:'fetch failed'}}});
 await assert.rejects(session.resolveAppRole(session.db as never,'qa@example.com'),/ตรวจสอบสิทธิ์/);
});
test('session lookup preserves a claims service outage instead of pretending the user is signed out',async()=>{
 const session=sessionModule({claims:{data:null,error:{name:'AuthRetryableFetchError',status:0,message:'fetch failed'}}});
 await assert.rejects(session.getCurrentAppSession(),/ตรวจสอบ|เชื่อมต่อ/);
});
