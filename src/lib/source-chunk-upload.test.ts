import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSourceChunks } from './source-chunk-upload';

test('a failed last part retries without resending successful parts',async()=>{
 const sent:string[]=[];let lastAttempts=0;
 const result=await uploadSourceChunks(new Blob(['abcdefghij']),4,'project/source/file',{
  upload:async(path)=>{sent.push(path);return {error:path.endsWith('002')&&++lastAttempts===1?{message:'Failed to fetch'}:null};},
  download:async()=>({data:null,error:{message:'not found'}}),wait:async()=>{},
 });
 assert.equal(result,3);assert.deepEqual(sent.map(path=>path.slice(-3)),['000','001','002','002']);
});
test('a lost success response verifies identical stored bytes after duplicate response',async()=>{
 let calls=0;
 await uploadSourceChunks(new Blob(['abc']),4,'project/source/file',{
  upload:async()=>({error:++calls===1?{message:'Failed to fetch'}:{statusCode:'409',message:'The resource already exists'}}),
  download:async()=>({data:new Blob(['abc']),error:null}),wait:async()=>{},
 });
 assert.equal(calls,2);
});
test('a duplicate with different bytes is never treated as a successful upload',async()=>{
 let calls=0;
 await assert.rejects(()=>uploadSourceChunks(new Blob(['abc']),4,'project/source/file',{
  upload:async()=>({error:++calls===1?{message:'Failed to fetch'}:{statusCode:'409',message:'The resource already exists'}}),
  download:async()=>({data:new Blob(['xyz']),error:null}),wait:async()=>{},
 }),/ไฟล์.*ไม่ตรง/);
});
test('permanent errors are not retried and transient failures stop after three attempts',async()=>{
 for(const [error,attempts] of [[{statusCode:'403',message:'Permission denied'},1],[{statusCode:'503',message:'Unavailable'},3]] as const){
  let calls=0;
  await assert.rejects(()=>uploadSourceChunks(new Blob(['abc']),4,'project/source/file',{
   upload:async()=>{calls++;return {error};},download:async()=>({data:null,error:null}),wait:async()=>{},
  }),/ส่วนที่ 1\/1/);
  assert.equal(calls,attempts);
 }
});
test('network exceptions during ambiguous-success verification also retry safely',async()=>{
 let uploads=0,downloads=0;
 await uploadSourceChunks(new Blob(['abc']),4,'project/source/file',{
  upload:async()=>{if(++uploads===1)throw new TypeError('Failed to fetch');return {error:{statusCode:409,message:'already exists'}};},
  download:async()=>{if(++downloads===1)throw new TypeError('Failed to fetch');return {data:new Blob(['abc']),error:null};},wait:async()=>{},
 });
 assert.equal(uploads,3);assert.equal(downloads,2);
});
