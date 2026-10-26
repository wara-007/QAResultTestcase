import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { updateSourceMapping } from './source-mapping-checkpoint';

test('large checkpoints travel in the body and use a compact row-version condition', async context => {
  const db = createClient('https://checkpoint-test.supabase.co','sb_publishable_test');
  const large = { sheets: 'x'.repeat(40_000), sheetImport: { complete:false } };
  let patchUrl: URL | undefined;
  context.mock.method(globalThis,'fetch',async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if(init?.method !== 'PATCH') return Response.json({ column_mapping:large, xmin:'123' });
    patchUrl = url;
    assert.equal(JSON.parse(String(init.body)).column_mapping.sheets.length, 40_000);
    return Response.json({id:'source'});
  });
  await updateSourceMapping(db,'project','source', mapping => ({...mapping, sheetImport:{complete:true}}));
  assert.ok(patchUrl);
  assert.ok(patchUrl.href.length < 300);
  assert.equal(patchUrl.searchParams.get('xmin'),'eq.123');
  assert.equal(patchUrl.searchParams.has('column_mapping'),false);
});

test('a changed row version is reread and unrelated concurrent metadata is preserved', async context => {
  const db = createClient('https://checkpoint-test.supabase.co','sb_publishable_test');
  let reads = 0, patches = 0;
  context.mock.method(globalThis,'fetch',async (_input: RequestInfo | URL, init?: RequestInit) => {
    if(init?.method !== 'PATCH') { reads++; return Response.json({ column_mapping:{ cover:reads===1?'old':'updated elsewhere' }, xmin:String(reads) }); }
    patches++;
    if(patches===1) return Response.json(null);
    assert.equal(JSON.parse(String(init.body)).column_mapping.cover,'updated elsewhere');
    return Response.json({id:'source'});
  });
  const mapping = await updateSourceMapping(db,'project','source', current => ({...current,sheetImport:{complete:true}}));
  assert.equal(reads,2);
  assert.equal(mapping.cover,'updated elsewhere');
});
