import assert from "node:assert/strict";
import test from "node:test";
import { evidenceUploadBatch } from "./evidence-upload-batch";

test("parallel references to one case/result/image perform only one upload", async () => {
  const upload = evidenceUploadBatch();
  let calls = 0;
  const transfer = async () => { calls++; await new Promise(resolve => setImmediate(resolve)); return true; };
  assert.deepEqual(await Promise.all(Array.from({ length: 4 }, () => upload("same-image", transfer))), [true, true, true, true]);
  assert.equal(calls, 1);
  await upload("different-owner", transfer);
  assert.equal(calls, 2);
});
test("a failed image can be retried in the next import batch", async () => {
  const first = evidenceUploadBatch();
  assert.equal(await first("image", async () => false), false);
  assert.equal(await evidenceUploadBatch()("image", async () => true), true);
});

test('shared proof uploads once and can be attached independently to every referencing row', async()=>{
 const {sharedEvidenceFiles}=await import('./evidence-upload-batch');
 const upload=sharedEvidenceFiles<{fileId:string}>();let transfers=0;
 const transfer=async()=>{transfers++;return {fileId:'shared-drive-file'};};
 const files=await Promise.all([upload('tab:hash',transfer),upload('tab:hash',transfer)]);
 assert.equal(transfers,1);assert.deepEqual(files,[{fileId:'shared-drive-file'},{fileId:'shared-drive-file'}]);
});
