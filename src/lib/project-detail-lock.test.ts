import assert from "node:assert/strict";
import test from "node:test";
import { beginProjectDetailRefresh, completeProjectDetailWrites, projectDetailRefreshPending, enqueueProjectDetailWrite } from "./project-detail-lock";
test('a rejected project write does not poison the queue or swallow its error', async () => {
  const first = enqueueProjectDetailWrite('failed-queue', async () => { throw new Error('database failure'); });
  const second = enqueueProjectDetailWrite('failed-queue', async () => 'saved');
  await assert.rejects(first, /database failure/);
  assert.equal(await second, 'saved');
  assert.equal(await enqueueProjectDetailWrite('failed-queue', async () => 'next batch'), 'next batch');
});
test("a failed write does not unlock while another write is still running", async () => {
  const release = beginProjectDetailRefresh("failed-project");
  let finish!: () => void;
  const slow = new Promise<void>(resolve => { finish = resolve; });
  const completion = completeProjectDetailWrites([Promise.reject(new Error("save failed")), slow]).finally(release);
  const assertion = assert.rejects(completion, /save failed/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(projectDetailRefreshPending("failed-project"), true);
  finish();
  await assertion;
  assert.equal(projectDetailRefreshPending("failed-project"), false);
});
test("overlapping route refreshes retain their write lock until every task settles", () => {
  const oldRouteFinished = beginProjectDetailRefresh("project");
  const newRouteFinished = beginProjectDetailRefresh("project");
  assert.equal(projectDetailRefreshPending("other-project"), false);
  newRouteFinished();
  assert.equal(projectDetailRefreshPending("project"), true);
  oldRouteFinished();
  assert.equal(projectDetailRefreshPending("project"), false);
  const nextFinished = beginProjectDetailRefresh("project");
  oldRouteFinished();
  assert.equal(projectDetailRefreshPending("project"), true);
  nextFinished();
  assert.equal(projectDetailRefreshPending("project"), false);
});

test('import waits for previously queued QA saves before loading its snapshot', async () => {
 const { waitForProjectDetailWrites } = await import('./project-detail-lock');
 const events:string[]=[];
 let finish!:()=>void;
 const pending=enqueueProjectDetailWrite('before-import',async()=>{await new Promise<void>(resolve=>{finish=resolve;});events.push('saved');});
 await Promise.resolve();
 const importReady=waitForProjectDetailWrites('before-import').then(()=>events.push('read latest workspace'));
 assert.deepEqual(events,[]);
 finish();await pending;await importReady;
 assert.deepEqual(events,['saved','read latest workspace']);
});

test('cancelled database transactions retry in the same queue and permanent errors do not retry', async () => {
 const { retryTimedOutProjectWrite }=await import('./project-detail-lock');
 let calls=0;const delays:number[]=[];
 const result=await retryTimedOutProjectWrite(async()=>({data:++calls,error:calls<3?{code:'57014'}:null}),async ms=>{delays.push(ms);});
 assert.equal(result.data,3);assert.deepEqual(delays,[500,1000]);
 calls=0;
 const denied=await retryTimedOutProjectWrite(async()=>({error:{code:'42501'},data:++calls}),async()=>{throw new Error('unexpected retry');});
 assert.equal(denied.data,1);
});
