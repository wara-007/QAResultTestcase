import assert from 'node:assert/strict';
import test from 'node:test';
import { storeSourceWorkbook, loadSourceWorkbookBytes, canRenderStoredCaseDetails } from './source-workbook-storage';
import type { WorkbookSource } from './types';
const source: WorkbookSource = { fileName:'case.xlsx', buffer:new Uint8Array([1,2,3]).buffer, bufferLoaded:true, sheetName:'Testcase',sheetPath:'xl/worksheets/sheet1.xml',columns:{},sheets:[] };

test('Sheets source saves metadata without sending XLSX bytes to Storage', async () => {
 let calls=0;
 const stored=await storeSourceWorkbook(source,'project','version','sheet',async()=>{calls++;return 2;},"google-sheets");
 assert.equal(calls,0); assert.equal(stored.byteSize,0); assert.equal(stored.storageKey,'');
 assert.equal(stored.sourceOrigin,'google-sheets'); assert.equal(stored.workbookStorage,'google-sheets'); assert.equal(stored.storageProvider,'local');
});
test('local Excel still uploads its original bytes and records its chunks',async()=>{
 let uploaded:ArrayBuffer|undefined;
 const stored=await storeSourceWorkbook(source,'project','version','',async(key,buffer)=>{assert.equal(key,'project/version/case.xlsx');uploaded=buffer;return 2;});
 assert.equal(uploaded,source.buffer);assert.equal(stored.byteSize,3);assert.equal(stored.chunkCount,2);assert.equal(stored.workbookStorage,'supabase');
});
test('metadata-only sources never read Storage; legacy sources still do',async()=>{
 let stored=0,sheets=0;
 const options={includeWorkbook:true,readStored:async()=>{stored++;return source.buffer;},readSheets:async()=>{sheets++;return source.buffer;}};
 await loadSourceWorkbookBytes({...options,mapping:{workbookStorage:'google-sheets'}});
 assert.equal(stored,0);assert.equal(sheets,1);
 await loadSourceWorkbookBytes({...options,mapping:{chunkCount:2}});
 assert.equal(stored,1);
 await loadSourceWorkbookBytes({...options,includeWorkbook:false,mapping:{workbookStorage:'google-sheets'}});
 assert.equal(sheets,1);
});
test('completed case details render from saved records, while unmapped tabs still request Sheets',()=>{
 const snapshot={workbookStorage:'google-sheets',sheetImport:{complete:true,refreshRequired:false}} as WorkbookSource;
 assert.equal(canRenderStoredCaseDetails(snapshot,true),true);
 assert.equal(canRenderStoredCaseDetails(snapshot,false),false);
 assert.equal(canRenderStoredCaseDetails({...snapshot,sheetImport:{...snapshot.sheetImport!,refreshRequired:true}},true),false);
 assert.equal(canRenderStoredCaseDetails({...snapshot,workbookStorage:'supabase'},true),false);
});

test('linking a project to Sheets never discards a manually uploaded workbook',async()=>{
 let uploads=0;const stored=await storeSourceWorkbook(source,'project','version','linked-sheet',async()=>{uploads++;return 1;});
 assert.equal(uploads,1);assert.equal(stored.sourceOrigin,'upload');assert.equal(stored.workbookStorage,'supabase');
});
