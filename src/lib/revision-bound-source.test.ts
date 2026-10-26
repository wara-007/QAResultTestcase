import assert from 'node:assert/strict';
import test from 'node:test';
import { revisionBoundSource, revisionBoundCheckpoint } from './revision-bound-source';
import { checkpointSheetImport } from './sheet-import-state';
import type { WorkbookSource } from './types';
const at='2026-10-26T00:00:00Z';
const source=(revision?:string,origin:WorkbookSource['sourceOrigin']='google-sheets'):WorkbookSource=>({sourceOrigin:origin,id:'old',fileName:'file.xlsx',buffer:new ArrayBuffer(2),bufferLoaded:true,sheetName:'Testcase',sheetPath:'xl/worksheets/sheet1.xml',columns:{},sheets:[],sheetImport:revision?{...checkpointSheetImport(undefined,'sheet',{Testcase:'loaded'},at,true),sourceRevision:revision}:undefined});
test('legacy partial import captures a usable revision instead of inheriting none',async()=>{
 let requested='';const parsed={...source(),id:undefined};
 const result=await revisionBoundSource('drive:2',source(),async revision=>{requested=revision;return parsed.buffer;},()=>parsed,async()=>'drive:2');
 assert.equal(requested,'drive:2');assert.equal(result.id,undefined);
 const checkpoint=revisionBoundCheckpoint(undefined,'sheet',{TC01:'loaded'},at,'drive:2');
 assert.equal(checkpoint.sourceRevision,'drive:2');assert.equal(checkpoint.complete,false);
});
test('only a verified cache for the same Sheets revision can be reused',async()=>{
 const cached=source('drive:2');let calls=0;
 assert.equal(await revisionBoundSource('drive:2',cached,async()=>{calls++;throw Error('unexpected');},()=>cached,async()=>'drive:2'),cached);
 assert.equal(calls,0);
 await assert.rejects(revisionBoundSource('drive:2',cached,async()=>cached.buffer,()=>cached,async()=>'drive:3'),/Sheets/);
});
test('stale and manually uploaded cached workbooks never masquerade as current Sheets bytes',async()=>{
 const parsed={...source(),id:undefined};let downloads=0;
 for(const cached of [source('drive:1'),source('drive:2','upload'),{...source('drive:2'),sourceOrigin:undefined}]){
  const result=await revisionBoundSource('drive:2',cached,async revision=>{assert.equal(revision,'drive:2');downloads++;return parsed.buffer;},()=>parsed,async()=>'drive:2');
  assert.equal(result.id,undefined);
 }
 assert.equal(downloads,3);
 await assert.rejects(revisionBoundSource('',null,async()=>parsed.buffer,()=>parsed,async()=>'drive:2'),/Sheets/);
});
test('partial refresh never declares every tab complete under a new or absent revision',()=>{
 const previous={...checkpointSheetImport(undefined,'sheet',{Testcase:'loaded',TC01:'loaded',TC02:'loaded'},at,true),sourceRevision:'drive:1'};
 assert.equal(revisionBoundCheckpoint(previous,'sheet',{TC01:'loaded'},at,'drive:2').complete,false);
 assert.equal(revisionBoundCheckpoint(previous,'sheet',{TC01:'loaded'},at,'drive:1').complete,true);
});
