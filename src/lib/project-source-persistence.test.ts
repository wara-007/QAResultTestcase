import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import type {WorkbookSource} from './types';

test('saving a linked Sheets source inserts metadata with zero physical bytes and no Storage request',async()=>{
 let inserted:Record<string,unknown>|undefined;
 const db={auth:{getUser:async()=>({data:{user:{id:'user'}}})},storage:{from(){throw Error('must not access Storage');}},from(table:string){
  const query={select(){return query;},eq(){return query;},order(){return query;},limit(){return query;},
   single:async()=>({data:{google_sheet_id:'sheet'},error:null}),maybeSingle:async()=>({data:{version_no:3},error:null}),
   insert:async(row:Record<string,unknown>)=>{assert.equal(table,'source_files');inserted=row;return {error:null};}};return query;
 }};
 const localRequire=createRequire(import.meta.url);
 const compiled=ts.transpileModule(readFileSync(new URL('./project-data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loadedModule={exports:{} as typeof import('./project-data')};
 runInNewContext(compiled,{exports:loadedModule.exports,module:loadedModule,crypto,Blob,ArrayBuffer,Uint8Array,require(id:string){if(id==='@/lib/supabase/client')return {createClient:()=>db};return localRequire(id);}});
 const source:WorkbookSource={fileName:'sheet.xlsx',buffer:new ArrayBuffer(50),bufferLoaded:true,sheetName:'Testcase',sheetPath:'xl/worksheets/sheet1.xml',columns:{id:'A'},sheets:[]};
 const saved=await loadedModule.exports.persistImportedWorkbook('project',[],source,false,"google-sheets");
 assert.equal((inserted?.column_mapping as Record<string,unknown>).sourceOrigin,'google-sheets');
 assert.equal(saved.source?.sourceOrigin,'google-sheets');
 assert.equal(inserted?.byte_size,0);assert.equal(inserted?.storage_key,'');assert.equal(inserted?.version_no,4);
 assert.equal((inserted?.column_mapping as Record<string,unknown>).workbookStorage,'google-sheets');
 assert.equal(saved.source?.workbookStorage,'google-sheets');assert.equal(saved.source?.buffer,source.buffer);
});

test('workbook hydration pins the held source ID instead of selecting another editor\'s latest version',async()=>{
 const filters:Record<string,string>={};let requested='';
 const db={from(){const query={select(){return query;},eq(key:string,value:string){filters[key]=value;return query;},order(){return query;},limit(){return query;},maybeSingle:async()=>({data:{id:filters.id ?? 'newer',storage_key:'',column_mapping:{workbookStorage:'google-sheets'}},error:null})};return query;}};
 const localRequire=createRequire(import.meta.url);
 const compiled=ts.transpileModule(readFileSync(new URL('./project-data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loadedModule={exports:{} as typeof import('./project-data')};
 runInNewContext(compiled,{exports:loadedModule.exports,module:loadedModule,ArrayBuffer,Uint8Array,fetch:async(url:string)=>{requested=url;return new Response(new Uint8Array([3,4]));},require(id:string){if(id==='@/lib/supabase/client')return {createClient:()=>db};return localRequire(id);}});
 await loadedModule.exports.loadProjectWorkbook('project','older');
 assert.equal(filters.id,'older');assert.match(requested,/sourceId=older$/);
});

for (const origin of ['upload','google-sheets',undefined]) test(`workspace hydration preserves ${origin ?? 'unknown'} origin separately from column mappings`,async()=>{
 const db={from(){const query={select(){return query;},eq(){return query;},order(){return query;},limit(){return query;},
  range:async()=>({data:[],error:null}),
  maybeSingle:async()=>({data:{id:'source',original_name:'book.xlsx',storage_key:'',sheet_name:'Testcase',column_mapping:{sourceOrigin:origin,workbookStorage:'supabase',id:'A',sheetImport:{version:1,spreadsheetId:'sheet',states:{},loadedAt:{},attemptedAt:'2026-10-26T00:00:00Z',complete:false}}},error:null})};return query;}};
 const localRequire=createRequire(import.meta.url);
 const compiled=ts.transpileModule(readFileSync(new URL('./project-data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loadedModule={exports:{} as typeof import('./project-data')};
 runInNewContext(compiled,{exports:loadedModule.exports,module:loadedModule,ArrayBuffer,Uint8Array,require(id:string){if(id==='@/lib/supabase/client')return {createClient:()=>db};return localRequire(id);}});
 const workspace=await loadedModule.exports.loadProjectWorkspace('project');
 assert.equal(workspace.source?.sourceOrigin,origin);
 assert.equal(workspace.source?.columns.sourceOrigin,undefined);
 assert.equal(workspace.source?.columns.id,'A');
 assert.equal(workspace.source?.sheetImport?.spreadsheetId,'sheet');
});
