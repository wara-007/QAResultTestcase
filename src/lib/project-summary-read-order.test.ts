import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('summary refresh reads source/token exactly once before starting case pagination',async()=>{
 let sourceReads=0,caseReads=0;
 let release!:()=>void;
 const sourceReady=new Promise<void>(resolve=>{release=resolve;});
 const source={select(){return source;},eq(){return source;},order(){return source;},limit(){return source;},maybeSingle(){return source;},then(resolve:(result:unknown)=>unknown){sourceReads++;return sourceReady.then(()=>resolve({data:null,error:null}));}};
 const cases={select(){return cases;},eq(){return cases;},order(){return cases;},range(){return Promise.resolve({data:[],error:null});}};
 const db={from(table:string){if(table==='source_files')return source;caseReads++;return cases;}};
 const compiled=ts.transpileModule(readFileSync(new URL('./project-data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const local=createRequire(import.meta.url),routeModule={exports:{} as {loadProjectWorkspace:(id:string,options:unknown)=>Promise<unknown>}};
 runInNewContext(compiled,{exports:routeModule.exports,module:routeModule,Error,Map,Promise,require(id:string){if(id==='@/lib/supabase/client')return {createClient:()=>db};return local(id.startsWith('./')?id:'./'+id.slice('@/lib/'.length));}});
 const pending=routeModule.exports.loadProjectWorkspace('p',{includeWorkbook:false,summaryConsistent:true});
 await Promise.resolve();await Promise.resolve();assert.equal(sourceReads,1);assert.equal(caseReads,0);
 release();await pending;assert.equal(sourceReads,1);assert.equal(caseReads,1);
});
