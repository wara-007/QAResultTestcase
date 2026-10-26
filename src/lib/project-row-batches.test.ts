import test from 'node:test';
import assert from 'node:assert/strict';
import { writeProjectRowBatches } from './project-row-batches';
test('large imports write bounded sequential batches and return every saved record',async()=>{
 const rows=Array.from({length:12},(_,i)=>i);const batches:number[][]=[];let active=0;
 const saved=await writeProjectRowBatches(rows,async batch=>{assert.equal(active++,0);batches.push(batch);await Promise.resolve();active--;return batch.map(i=>({id:i}));});
 assert.deepEqual(batches.map(batch=>batch.length),[5,5,2]);assert.deepEqual(saved.map(row=>row.id),rows);
});
test('a failed batch prevents later writes and empty imports do not issue an empty upsert',async()=>{
 let calls=0;
 await assert.rejects(()=>writeProjectRowBatches(Array.from({length:12},(_,i)=>i),async batch=>{if(++calls===2)throw new Error('save failed');return batch;}),/save failed/);
 assert.equal(calls,2);assert.deepEqual(await writeProjectRowBatches([],async()=>{throw new Error('empty SQL');}),[]);
});
