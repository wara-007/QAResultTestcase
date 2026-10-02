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
