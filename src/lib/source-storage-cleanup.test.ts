import assert from 'node:assert/strict';
import test from 'node:test';
import { planSourceStorageCleanup, sourceStoragePaths } from './source-storage-cleanup';
const source=(id:string,version:number,extra={})=>({id,project_id:'project',version_no:version,storage_provider:'supabase',storage_key:`project/${id}/book.xlsx`,byte_size:10,column_mapping:{sourceOrigin:'google-sheets',chunkCount:2,sheetImport:{spreadsheetId:'sheet'}},...extra});
const projects=[{id:'project',google_sheet_id:'sheet'}];
test('only old unreferenced Sheets copies are eligible; latest, cases, export jobs and history are retained even when an older import was interrupted',()=>{
 const sources=[source('latest',6),source('case',5),source('export',4),source('history',3),source('old',2),source('pending',1,{column_mapping:{sourceOrigin:'google-sheets',sheetImport:{spreadsheetId:'sheet',complete:false}}})];
 const plan=planSourceStorageCleanup({projects,sources,verifiedProjectIds:['project'],references:[{source_file_id:'case'},{source_file_id:'export'},{header:{source:{storageKey:'project/history/book.xlsx'}}}]});
 assert.deepEqual(plan.eligible.map(item=>item.id),['old','pending']);assert.equal(plan.bytes,20);
});
test('local uploads, foreign paths, deleted objects, unknown providers and shared paths are never cleanup candidates',()=>{
 const local={id:'local',google_sheet_id:''};
 const sources=[source('latest',7),source('local',1,{project_id:'local'}),source('wrong',1,{storage_key:'other/wrong/book.xlsx'}),source('gone',1,{storage_key:'',byte_size:0}),source('r2',1,{storage_provider:'r2'}),source('alias',1,{storage_key:'project/latest/book.xlsx'}),source('alias2',1,{storage_key:'project/latest/book.xlsx'})];
 assert.equal(planSourceStorageCleanup({projects:[...projects,local],sources,verifiedProjectIds:['project'],references:[]}).eligible.length,0);
});
test('storage paths reject traversal and invalid chunk counts instead of deleting broader prefixes',()=>{
 assert.deepEqual(sourceStoragePaths(source('old',1)),['project/old/book.xlsx/part-000','project/old/book.xlsx/part-001']);
 assert.deepEqual(sourceStoragePaths(source('old',1,{column_mapping:{}})),['project/old/book.xlsx']);
 assert.throws(()=>sourceStoragePaths(source('old',1,{storage_key:'project/old/../x.xlsx'})));
 assert.throws(()=>sourceStoragePaths(source('old',1,{column_mapping:{chunkCount:-1}})));
});

test('an unverified project is held even when its old copies have no references',()=>{
 assert.equal(planSourceStorageCleanup({projects,sources:[source('latest',2),source('old',1)],references:[],verifiedProjectIds:[]}).eligible.length,0);
});

test('a historic local upload is retained after its project connects to Sheets',()=>{
 const plan=planSourceStorageCleanup({projects,sources:[source('latest',2),source('local',1,{column_mapping:{documentType:'xlsx'}})],references:[],verifiedProjectIds:['project']});
 assert.equal(plan.eligible.length,0);
});

for (const origin of ['upload', undefined]) test(`a ${origin ?? 'legacy unknown'} source remains held after receiving a Sheets checkpoint`,()=>{
 const plan=planSourceStorageCleanup({projects,sources:[source('latest',2),source('old',1,{column_mapping:{sourceOrigin:origin,workbookStorage:'supabase',sheetImport:{spreadsheetId:'sheet',complete:true}}})],references:[],verifiedProjectIds:['project']});
 assert.equal(plan.eligible.length,0);
 assert.equal(plan.retained.find(item=>item.id==='old')?.reason,'unproven-sheets-origin');
});
