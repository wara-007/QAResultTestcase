import assert from 'node:assert/strict';
import test from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readProjectCreatorNames} from './project-creator-names';
test('creator names read only display names for owners of visible projects in bounded batches',async()=>{
 const selected:string[]=[],batches:string[][]=[];
 const db={from(table:string){assert.equal(table,'profiles');return {select(columns:string){selected.push(columns);return {in(field:string,ids:string[]){assert.equal(field,'id');batches.push(ids);return Promise.resolve({data:ids.map(id=>({id,display_name:'Name '+id})),error:null});}};}};}} as unknown as SupabaseClient;
 const rows=Array.from({length:102},(_,i)=>({owner_id:'owner-'+i}));
 const names=await readProjectCreatorNames(db,[...rows,rows[0]]);
 assert.equal(names.size,102);assert.deepEqual(batches.map(batch=>batch.length),[100,2]);assert.ok(selected.every(columns=>columns==='id,display_name'));
 assert.equal(names.get('owner-101'),'Name owner-101');
});
test('an empty authorized catalog does not query creator profiles',async()=>{
 const db={from(){throw Error('must not query');}} as unknown as SupabaseClient;
 assert.equal((await readProjectCreatorNames(db,[])).size,0);
});
