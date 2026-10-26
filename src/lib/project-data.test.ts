import assert from "node:assert/strict";
import test from "node:test";
import { loadProjectWorkspace, persistTestCaseResult } from "./project-data";
import { casesFromRows } from "./testcase-rows";

test('bulk case saves queue before sending RPCs that lock the same project', async context => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://workspace-saving-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  context.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  });
  let release!: () => void, entered!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const firstStarted = new Promise<void>(resolve => { entered = resolve; });
  const sent: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.pathname, '/rest/v1/rpc/save_test_case_result');
    const body = JSON.parse(String(init?.body));
    const key = `${body.requested_project_id}:${body.requested_case.id}`;
    sent.push(key);
    if (key === 'shared:TC1') { entered(); await blocked; }
    return Response.json({recordId: body.requested_case.id, executionId: `execution-${key}`, resultReference: body.requested_execution.resultReference});
  });
  const items = casesFromRows([['Test Case ID','Test Case Name'],['TC1','First'],['TC2','Second']]);
  const writes = [persistTestCaseResult('shared', items[0]), persistTestCaseResult('shared', items[1]), persistTestCaseResult('other', items[0])];
  try {
    await firstStarted;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sent.sort(), ['other:TC1','shared:TC1']);
  } finally { release(); await Promise.allSettled(writes); }
  assert.equal(sent.filter(key => key === 'shared:TC2').length, 1);
});

test("workspace loads every testcase beyond the REST response cap", async (context) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://workspace-paging-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  context.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  });
  const rows = Array.from({ length: 1201 }, (_, index) => ({
    id: `record-${index}`, testcase_key: `TC-${index}`, source_row: index + 2, sort_order: index,
    platform: "", condition_text: "", scenario: "", case_name: `Case ${index}`, steps: "",
    expected_result: "", test_data: "", test_executions: [],
  }));
  const requests: URL[] = [];
  context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://workspace-paging-test.supabase.co");
    if (url.pathname.endsWith("/source_files")) return Response.json([]);
    assert.ok(url.pathname.endsWith("/test_cases"));
    requests.push(url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);
    return Response.json(rows.slice(offset, offset + limit));
  });
  const workspace = await loadProjectWorkspace("project-id");
  assert.equal(workspace.cases.length, 1201);
  assert.equal(workspace.cases[1200].id, "TC-1200");
  assert.equal(new Set(workspace.cases.map(item => item.id)).size, 1201);
  assert.ok(requests.every(url => url.searchParams.get("order")?.endsWith("id.asc")));
});
test('workspace reads large execution snapshots in bounded pages without losing cases or evidence', async context => {
  const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://workspace-large-results-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  context.after(()=>{
    if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
    if(previousKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=previousKey;
  });
  const rows=Array.from({length:62},(_,index)=>({id:`record-${index}`,testcase_key:`TC-${index}`,source_row:index+2,sort_order:index,platform:'',condition_text:'',scenario:'',case_name:`Case ${index}`,steps:'',expected_result:'',test_data:'',test_executions:[{id:`execution-${index}`,attempt_no:1,status:'Pass',result_reference:`qa-results:${JSON.stringify({version:4,results:[{id:'proof',status:'Pass',evidence:[{fileId:`image-${index}`,name:'proof.gif',mimeType:'image/gif'}]}]})}`}]}));
  context.mock.method(globalThis,'fetch',async(input:RequestInfo|URL)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.pathname.endsWith('/source_files'))return Response.json([]);
    const limit=Number(url.searchParams.get('limit')??1000),offset=Number(url.searchParams.get('offset')??0);
    if(limit>10)return Response.json({code:'57014',message:'canceling statement due to statement timeout'},{status:500});
    return Response.json(rows.slice(offset,offset+limit));
  });
  const workspace=await loadProjectWorkspace('project-id');
  assert.equal(workspace.cases.length,62);
  assert.deepEqual(workspace.cases.map(item=>item.results?.[0].evidence[0].fileId),rows.map((_,index)=>`image-${index}`));
});
