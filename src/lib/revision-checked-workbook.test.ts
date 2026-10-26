import assert from 'node:assert/strict';
import test from 'node:test';
import { revisionCheckedWorkbook } from './revision-checked-workbook';
test('a workbook for a saved revision is returned only if Sheets stays at that revision',async()=>{
 const buffer=new ArrayBuffer(4);let downloads=0;
 assert.equal(await revisionCheckedWorkbook('drive:1',async()=>'drive:1',async()=>{downloads++;return buffer;}),buffer);
 assert.equal(downloads,1);
 await assert.rejects(revisionCheckedWorkbook('drive:1',async()=>'drive:2',async()=>{downloads++;return buffer;}),/Sheets/);
 assert.equal(downloads,1);
});
test('a revision changed during download and a missing revision cannot masquerade as a saved source',async()=>{
 let calls=0;
 await assert.rejects(revisionCheckedWorkbook('drive:1',async()=>++calls===1?'drive:1':'drive:2',async()=>new ArrayBuffer(4)),/Sheets/);
 await assert.rejects(revisionCheckedWorkbook('',async()=>'drive:1',async()=>new ArrayBuffer(4)),/Sheets/);
});

test('content-hash revisions verify the downloaded bytes without downloading the same workbook three times',async()=>{
 let downloads=0;
 const bytes=new ArrayBuffer(2);
 assert.equal(await revisionCheckedWorkbook('xlsx-v2:hash',async()=>{throw Error('unnecessary export');},async()=>{downloads++;return bytes;},()=>'xlsx-v2:hash'),bytes);
 assert.equal(downloads,1);
 await assert.rejects(revisionCheckedWorkbook('xlsx-v2:hash',async()=>{throw Error('unnecessary export');},async()=>bytes,()=>'xlsx-v2:changed'),/Sheets/);
});
