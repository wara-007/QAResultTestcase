import assert from 'node:assert/strict';
import test from 'node:test';
import { readAllRows } from './paged-rows';
test('collects all stable rows beyond the REST cap without duplicating a boundary row',async()=>{
  const source=Array.from({length:1201},(_,id)=>({id}));
  const rows=await readAllRows(async(start,end)=>({data:source.slice(start,end+1),error:null}));
  assert.equal(rows.length,1201);assert.equal(rows[500].id,500);assert.equal(rows[1200].id,1200);assert.equal(new Set(rows.map(r=>r.id)).size,1201);
});
test('a failed later page cannot silently become a partial dashboard',async()=>{
  await assert.rejects(readAllRows(async start=>start ? {data:null,error:{message:'offline'}} : {data:Array.from({length:500},(_,id)=>({id})),error:null}),/offline/);
});

test('opt-in timeout recovery retries the same offset with smaller pages and keeps every row', async () => {
  const source = Array.from({length: 13}, (_, id) => ({id}));
  const calls: [number,number][] = [];
  const rows = await readAllRows(async (start,end) => {
    calls.push([start,end]);
    if (start >= 4 && end-start+1 > 2) return {data:null,error:{message:'canceling statement due to statement timeout',code:'57014'}};
    return {data:source.slice(start,end+1),error:null};
  }, 4, {shrinkOnTimeout:true});
  assert.deepEqual(calls.slice(0,3), [[0,3],[4,7],[4,5]]);
  assert.deepEqual(rows,source);
});
test('timeout recovery stops at one row and never returns an incomplete result', async () => {
  let calls = 0;
  await assert.rejects(readAllRows(async () => { calls++; return {data:null,error:{message:'canceling statement due to statement timeout',code:'57014'}}; }, 4, {shrinkOnTimeout:true}), /statement timeout/);
  assert.equal(calls,3);
});
