import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';

function authRoute(file:string,options:{role?:'qa'|'po'|null;roleError?:boolean;signInError?:unknown}={}){
 const user={email:'qa@example.com',user_metadata:{password_configured:true}};
 const db={auth:{signInWithPassword:async()=>({data:{user},error:options.signInError ?? null}),getClaims:async()=>({data:{claims:{email:user.email,user_metadata:user.user_metadata}}}),exchangeCodeForSession:async()=>({data:{user},error:null}),updateUser:async()=>({error:null})}};
 const localRequire=createRequire(import.meta.url);const deleted:string[]=[];
 const compiled=ts.transpileModule(readFileSync(new URL('../app/auth/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const serverModule={exports:{} as {POST?:(request:Request)=>Promise<Response>;GET?:(request:Request)=>Promise<Response>}};
 runInNewContext(compiled,{exports:serverModule.exports,module:serverModule,URL,Error,require(id:string){
  if(id==='next/server')return {NextResponse:{redirect:(url:URL,status=307)=>Object.assign(new Response(null,{status,headers:{location:url.href}}),{cookies:{delete:(name:string)=>deleted.push(name),set:()=>{}}})}};
  if(id==='next/headers')return {cookies:async()=>({get:()=>({value:'/groups/g/projects/p/test-cases'})})};
  if(id==='@/lib/app-session')return {resolveAppRole:async()=>{if(options.roleError)throw Error('database timeout');return options.role===undefined?'qa':options.role;}};
  if(id==='@/lib/supabase/server')return {createClient:async()=>db};
  if(id==='@/lib/google-user-oauth')return {appOrigin:(url:string)=>new URL(url).origin,safeReturnTo:(value:string)=>value?.startsWith('/')&&!value.startsWith('//')?value:'/groups',AUTH_RETURN_TO_COOKIE:'return-to',GOOGLE_USER_COOKIE:'google-drive'};
  if(id.startsWith('@/lib/'))return localRequire('./'+id.slice('@/lib/'.length));return localRequire(id);
 }});
 return {...serverModule.exports,deleted};
}
const target='/groups/g/projects/p/test-cases';
function loginRequest(){return new Request('http://localhost:3002/auth/password/sign-in',{method:'POST',body:new URLSearchParams({email:'qa@example.com',password:'example-test-password',next:target})});}
test('a successful password login with failed role lookup preserves session destination and offers retry',async()=>{
 const route=authRoute('password/sign-in/route.ts',{roleError:true});const response=await route.POST!(loginRequest());
 const location=new URL(response.headers.get('location')!);assert.equal(response.status,303);assert.equal(location.pathname,'/auth/login');assert.equal(location.searchParams.get('next'),target);assert.match(location.searchParams.get('error')!,/ตรวจสอบสิทธิ์/);
});
test('password service failure is not reported as incorrect credentials',async()=>{
 const route=authRoute('password/sign-in/route.ts',{signInError:{status:503,message:'fetch failed'}});const response=await route.POST!(loginRequest());
 assert.match(new URL(response.headers.get('location')!).searchParams.get('error')!,/เชื่อมต่อ/);
});
test('invalid credentials still show a login error',async()=>{
 const route=authRoute('password/sign-in/route.ts',{signInError:{status:400,code:'invalid_credentials',message:'Invalid login credentials'}});const response=await route.POST!(loginRequest());
 assert.match(new URL(response.headers.get('location')!).searchParams.get('error')!,/รหัสผ่านไม่ถูกต้อง/);
});
test('verified unapproved users still reach pending access',async()=>{
 const route=authRoute('password/sign-in/route.ts',{role:null});const response=await route.POST!(loginRequest());assert.equal(new URL(response.headers.get('location')!).pathname,'/auth/access-denied');
});
test('Google callback role outage retains Drive session and intended destination',async()=>{
 const route=authRoute('callback/route.ts',{roleError:true});const response=await route.GET!(new Request('http://localhost:3002/auth/callback?code=example-code'));
 const location=new URL(response.headers.get('location')!);assert.equal(location.pathname,'/auth/login');assert.equal(location.searchParams.get('next'),target);assert.ok(!route.deleted.includes('google-drive'));
});
test('existing-session Google sign in does not restart OAuth or claim pending access when role lookup fails',async()=>{
 const route=authRoute('sign-in/route.ts',{roleError:true});const response=await route.GET!(new Request('http://localhost:3002/auth/sign-in?next='+encodeURIComponent(target)));
 const location=new URL(response.headers.get('location')!);assert.equal(location.pathname,'/auth/login');assert.equal(location.searchParams.get('next'),target);
});
