import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { Project } from './types';

// Exercise the server loader with bounded database responses, without opening a
// network connection or loading Next's server-only runtime in Node's test runner.
function planningServer(failure?: { table: string; message: string; thrown?: boolean; timeoutOver?: number }, fixtures: Record<string, unknown[]> = {}) {
  const rows: Record<string, unknown[]> = {
    test_cases: [
      { id: 'registered', project_id: 'p', testcase_key: 'TC01', source_row: 2, steps: '', expected_result: '', test_executions: [{ attempt_no: 1, status: 'Pass', result_reference: '' }] },
      { id: 'orphan', project_id: 'p', testcase_key: 'TC99', source_row: 0, steps: '', expected_result: '', test_executions: [{ attempt_no: 1, status: 'Failed', result_reference: 'qa-results:{"sourceSheetName":"RC TC99","results":[]}' }] },
    ],
    sprint_project_counts: [{ project_id: 'p', counts: { totalCases: 2, pass: 1, failed: 1, skip: 0, inProgress: 0, notStart: 0, openDefects: 0 } }],
  };
  Object.assign(rows,fixtures);
  const reads: Array<{table:string;start:number;end:number}> = [];
  const limits: Array<{table:string;count:number;relation?:string}> = [];
  function query(name: string) {
    let start=0,end=499;
    const response: {data:unknown;error:{message:string;code?:string}|null} = { data: name === 'can_manage_sprint' ? false : name === 'groups' ? { name: 'Group' } : rows[name] ?? [], error: failure?.table === name && !failure.thrown ? { message: failure.message } : null };
    const builder = {
      select() { return builder; }, eq() { return builder; }, order() { return builder; },
      range(a:number,b:number) { start=a;end=b;reads.push({table:name,start,end});return builder; }, limit(count:number,options?:{referencedTable?:string}) {limits.push({table:name,count,relation:options?.referencedTable});return builder;}, or() { return builder; }, maybeSingle() { return builder; },
      then(resolve: (value: typeof response) => unknown, reject?: (reason: unknown) => unknown) { return (failure?.table === name && failure.thrown ? Promise.reject(new Error(failure.message)) : Promise.resolve(failure?.timeoutOver && failure.table===name ? end-start+1>failure.timeoutOver ? {...response,data:null,error:{message:failure.message,code:'57014'}} : {...response,data:(rows[name] ?? []).slice(start,end+1),error:null} : response)).then(resolve, reject); },
    };
    return builder;
  }
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL('./planning-server.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const serverModule = { exports: {} as Pick<typeof import('./planning-server'), 'loadSprintDashboard' | 'loadPlanning'> };
  runInNewContext(compiled, {
    exports: serverModule.exports, module: serverModule, Error,
    require(id: string) {
      if (id === 'server-only') return {};
      if (id === '@/lib/supabase/server') return { createClient: async () => {
        if (failure?.table === 'client') throw new Error(failure.message);
        return { from: query, rpc: query };
      } };
      if (id === './project-sprint-history-server') return {
        loadSprintParticipationHeaders: async () => ({ episodes: [], headers: [] }),
        loadSprintSnapshotPerformance: async () => ({ archived: [], baseline: [] }),
      };
      return localRequire(id);
    },
  });
  return Object.assign(serverModule.exports,{reads,limits});
}

test('dashboard totals exclude sheet-only snapshots even when their keys resemble registered cases', async () => {
  const project: Project = { id: 'p', name: 'Project', description: '', sprintId: 's', sprintNo: '1', environment: 'UAT', googleSheetId: '', googleSheetUrl: '', createdAt: '', canView: true, canEdit: false, canManage: false, canDelete: false };
  const result = await planningServer().loadSprintDashboard('g', 's', [project]);
  assert.equal(result.error, '');
  assert.equal(result.data?.summary.totalCases, 1);
  assert.equal(result.data?.summary.pass, 1);
  assert.equal(result.data?.summary.failed, 0);
  assert.equal(result.data?.summary.progress, 100);
});

for (const failure of [
  { table: 'sprints', message: 'Permission denied reading Sprint data' },
  { table: 'sprints', message: 'Network fetch failed', thrown: true },
  { table: 'client', message: 'Database client unavailable', thrown: true },
]) {
  test(`planning displays the actual load failure: ${failure.message}`, async () => {
    const result = await planningServer(failure).loadPlanning('g');
    assert.equal(result.error, failure.message);
    assert.deepEqual(Array.from(result.sprints), []);
  });
}

const dashboardProject:Project={id:'p',name:'Project',description:'',sprintId:'s',sprintNo:'1',environment:'UAT',googleSheetId:'',googleSheetUrl:'',createdAt:'',canView:true,canEdit:false,canManage:false,canDelete:false};
test('Sprint summary uses the already loaded register instead of running a second expensive aggregate RPC',async()=>{
 const server=planningServer({table:'sprint_project_counts',message:'canceling statement due to statement timeout'});
 const result=await server.loadSprintDashboard('g','s',[dashboardProject]);
 assert.equal(result.error,'');assert.equal(result.data?.summary.totalCases,1);
});
test('Sprint cases read bounded pages and retry smaller pages without losing registered rows',async()=>{
 const server=planningServer({table:'test_cases',message:'canceling statement due to statement timeout',timeoutOver:1});
 const result=await server.loadSprintDashboard('g','s',[dashboardProject]);
 assert.equal(result.error,'');assert.equal(result.data?.summary.totalCases,1);
 assert.ok(server.reads.filter(read=>read.table==='test_cases').every(read=>read.end-read.start+1<=10));
 assert.ok(server.reads.some(read=>read.table==='test_cases' && read.start===1));
});
test('Sprint register queries load only the latest execution per case',async()=>{
 const server=planningServer();await server.loadSprintDashboard('g','s',[dashboardProject]);
 assert.ok(server.limits.some(limit=>limit.table==='test_cases' && limit.count===1 && limit.relation==='test_executions'));
});

test('Sprint defects include standalone register records and register status wins duplicate Jira references',async()=>{
 const defect=(id:string,status:string,jiraUrl='')=>({id,status,jiraUrl,evidence:[],title:id,description:'',apiResponse:'',log:'',createdAt:''});
 const server=planningServer(undefined,{
  test_cases:[{id:'registered',project_id:'p',testcase_key:'TC01',source_row:2,steps:'',expected_result:'',test_executions:[{attempt_no:1,status:'Pass',result_reference:'qa-results:'+JSON.stringify({defects:[defect('DEF-1','Open','https://jira/BUG-1'),defect('DEF-2','Open','https://jira/BUG-1')]})}]}],
  source_files:[{column_mapping:{sheets:[{name:'Defected',defects:[defect('DEF-1','Closed','https://jira/BUG-1'),defect('DEF-3','Open')]}]}}],
 });
 const result=await server.loadSprintDashboard('g','s',[dashboardProject]);
 assert.equal(result.error,'');assert.equal(result.data?.summary.totalDefects,2);assert.equal(result.data?.summary.openDefects,1);assert.equal(result.data?.summary.closedDefects,1);
});
