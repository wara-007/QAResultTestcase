import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
test('Sprint route returns the interactive loader without awaiting all result payloads in SSR',async()=>{
 const source=readFileSync(new URL('../app/groups/[groupId]/years/[year]/sprints/[sprintId]/page.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 let heavyCalls=0;const loader=()=>null;
 const route={exports:{} as {default:(input:{params:Promise<{groupId:string;year:string;sprintId:string}>})=>Promise<{type:unknown}>}};
 const requireLocal=createRequire(import.meta.url);
 runInNewContext(compiled,{module:route,exports:route.exports,Promise,require(id:string){
  if(id==='next/navigation')return {notFound:()=>{throw Error('not found');}};
  if(id==='@/lib/planning-server')return {loadPlanning:async()=>({sprints:[{id:'s',year:2026}],groupName:'Group',error:''}),loadSprintDashboard:async()=>{heavyCalls++;throw Error('SSR must not wait for result payloads');}};
  if(id==='@/lib/projects-server')return {loadProjects:async()=>({projects:[],currentUser:null,error:''})};
  if(id==='@/components/sprint-dashboard-loader')return {SprintDashboardLoader:loader};
  if(id==='@/components/sprint-dashboard')return {SprintDashboard:()=>null};
  if(id==='@/components/planning-home')return {PlanningHome:()=>null};
  return requireLocal(id);
 }});
 const element=await route.exports.default({params:Promise.resolve({groupId:'g',year:'2026',sprintId:'s'})});
 assert.equal(heavyCalls,0);assert.equal(element.type,loader);
});
