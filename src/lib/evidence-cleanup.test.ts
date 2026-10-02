import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGoogleEvidence, isOwnedGoogleEvidence, canDeleteGroup, cleanupGoogleWithWarning } from './evidence-cleanup';

test('Google permission failure returns a warning without rejecting deletion',async()=>{
  const result=await cleanupGoogleWithWarning(async()=>{throw new Error('insufficientFilePermissions');});
  assert.equal(result.deletedGoogleImages,0);
  assert.equal(result.warnings.length,1);
  assert.match(result.warnings[0],/Google/);
});
test('successful Google cleanup has no warning and preserves its count',async()=>{
  assert.deepEqual(await cleanupGoogleWithWarning(async()=>3),{deletedGoogleImages:3,warnings:[]});
});

test('only Group Owner or System Owner can delete a group', () => {
  assert.equal(canDeleteGroup('owner','owner',false),true);
  assert.equal(canDeleteGroup('admin','owner',false),false);
  assert.equal(canDeleteGroup('system','owner',true),true);
  assert.equal(canDeleteGroup('','',false),false);
});
test('collects deduplicated Drive evidence from results and defects, not arbitrary text or R2', () => {
  const file={fileId:'image1',name:'1234567890123-a.png',mimeType:'image/png',provider:'google-drive'};
  assert.deepEqual(collectGoogleEvidence(['qa-results:'+JSON.stringify({results:[{evidence:[file,file]}],defects:[{evidence:[{...file,fileId:'image2'}]}],apiResponse:{fileId:'not-evidence'},evidence:[{...file,fileId:'r2',provider:'cloudflare-r2'}]})]).map(e=>e.fileId),['image1','image2']);
});
test('never treats Sheets, foreign project markers or imported media as deletable evidence', () => {
  assert.equal(isOwnedGoogleEvidence({mimeType:'application/vnd.google-apps.spreadsheet',appProperties:{qaProjectId:'p'}},'p',false),false);
  assert.equal(isOwnedGoogleEvidence({mimeType:'image/png',appProperties:{qaProjectId:'other'}},'p',true),false);
  assert.equal(isOwnedGoogleEvidence({mimeType:'image/png',appProperties:{qaProjectId:'p'}},'p',false),true);
  assert.equal(isOwnedGoogleEvidence({mimeType:'image/png'},'p',false),false);
  assert.equal(isOwnedGoogleEvidence({mimeType:'image/png',name:'1234567890123-proof.png'},'p',true),true);
});
