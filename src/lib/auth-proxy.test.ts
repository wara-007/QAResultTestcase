import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
class RequestUrl extends URL {clone(){return new RequestUrl(this.href);}}
function proxyModule(access:{data:unknown;error:unknown},claimsError:unknown=null){
 const localRequire=createRequire(import.meta.url);
 const result=(kind:string,status:number,body?:unknown,location?:URL)=>({kind,status,body,headers:new Headers(location?{location:location.href}:{}),cookies:{getAll:()=>[],set:()=>{}}});
 const response={next:()=>result('next',200),json:(body:unknown,{status}:{status:number})=>result('json',status,body),redirect:(url:URL)=>result('redirect',307,undefined,url)};
 const db={auth:{getClaims:async()=>({data:claimsError?null:{claims:{email:'qa@example.com'}},error:claimsError})},rpc:()=>({abortSignal(){return this;},then(resolve:(v:unknown)=>unknown){return Promise.resolve(access).then(resolve);}})};
 const compiled=ts.transpileModule(readFileSync(new URL('./supabase/proxy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const serverModule={exports:{} as {updateSession:(request:unknown)=>Promise<ReturnType<typeof result>>}};
 runInNewContext(compiled,{exports:serverModule.exports,module:serverModule,URL,AbortSignal,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test'}},require(id:string){if(id==='../auth-check')return localRequire('./auth-check');if(id==='@supabase/ssr')return {createServerClient:()=>db};if(id==='next/server')return {NextResponse:response};if(id.startsWith('@/lib/'))return localRequire('./'+id.slice('@/lib/'.length));return localRequire(id);}});
 return (path:string)=>serverModule.exports.updateSession({nextUrl:new RequestUrl('http://localhost:3002'+path),cookies:{getAll:()=>[],set:()=>{}}});
}
test('permission RPC timeout never permits a protected API request',async()=>{
 const response=await proxyModule({data:null,error:{code:'57014',message:'timeout'}})('/api/projects/p/evidence');
 assert.equal(response.status,503);assert.equal(response.kind,'json');
});
test('permission RPC timeout shows retry instead of pending access on protected pages',async()=>{
 const response=await proxyModule({data:null,error:{message:'fetch failed'}})('/groups/g/projects/p/test-cases');
 const target=new URL(response.headers.get('location')!);
 assert.equal(target.pathname,'/auth/login');assert.equal(target.searchParams.get('next'),'/groups/g/projects/p/test-cases');assert.ok(target.searchParams.get('error'));
});
test('authentication service outage is distinct from an unauthenticated API request',async()=>{
 const response=await proxyModule({data:true,error:null},{status:0,message:'fetch failed'})('/api/projects/p/evidence');
 assert.equal(response.status,503);
});
test('verified allowlist denial still denies access',async()=>{
 const response=await proxyModule({data:false,error:null})('/api/projects/p/evidence');assert.equal(response.status,403);
});
test('verified authorization still allows the protected request',async()=>{
 const response=await proxyModule({data:true,error:null})('/api/projects/p/evidence');assert.equal(response.kind,'next');
});
