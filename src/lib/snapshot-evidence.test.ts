import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotEvidenceFromStored, snapshotEvidenceMatches } from './snapshot-evidence';
test('archived references retain shared media and resolve only actual evidence members',()=>{
 const image={fileId:'drive123456',name:'a',mimeType:'image/png'},video={fileId:'r2',objectKey:'projects/p/video',provider:'cloudflare-r2' as const,name:'video',mimeType:'video/mp4',url:'https://example.com/video'};
 const cases=[{id:'case',testcase_key:'TC01',test_executions:[{attempt_no:1,result_reference:`qa-results:${JSON.stringify({results:[{evidence:[image,video]}],defects:[{evidence:[image]}]})}`}]}];
 assert.equal(snapshotEvidenceFromStored(cases).length,2);
 assert.ok(snapshotEvidenceMatches(cases,image));
 assert.equal(snapshotEvidenceMatches(cases,{...image,fileId:'other'}),false);
 assert.ok(snapshotEvidenceMatches(cases,video));
});
