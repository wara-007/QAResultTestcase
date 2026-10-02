import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "00000000-0000-4000-8000-000000000001";
const qa = "00000000-0000-4000-8000-000000000002";
const viewer = "00000000-0000-4000-8000-000000000003";
const project = "10000000-0000-4000-8000-000000000001";
const productionFunction = (source: string, name: string) => {
  const start = source.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `Missing production function ${name}`);
  return source.slice(start, source.indexOf("$$;", start) + 3);
};

test("planning migration preserves projects, enforces RLS and records moves atomically", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const accessSql = await readFile("supabase/migrations/20260909193000_add_app_allowlist.sql", "utf8");
  const globalSql = await readFile("supabase/migrations/20260929114538_global_project_read_and_sheet_mappings.sql", "utf8");
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key, email text, enabled boolean default true, system_owner boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function private.has_app_access() returns boolean language sql stable security definer as $$ select exists(select 1 from auth.users where id = auth.uid() and enabled) $$;
    create function private.is_system_owner() returns boolean language sql stable security definer as $$ select exists(select 1 from auth.users where id = auth.uid() and enabled and system_owner) $$;
    create table public.groups(id text primary key, owner_id uuid);
    create table public.group_members(group_id text, user_id uuid, role text);
    create table public.projects(id uuid primary key default gen_random_uuid(), group_id text not null references public.groups,
      owner_id uuid not null, name text not null, description text not null default '', environment text not null default 'UAT',
      sprint_no text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table public.project_approval_requests(project_id uuid, status text);
    create table public.profiles(id uuid primary key, display_name text);
    create table public.test_cases(id uuid primary key, project_id uuid references projects(id), testcase_key text);
    create table public.test_executions(id uuid primary key default gen_random_uuid(), project_id uuid references projects(id), test_case_id uuid references test_cases(id), attempt_no integer default 1, status text default 'Not Start', result_reference text default '', executed_by_name text default '', created_at timestamptz default now());
    insert into auth.users(id,email) values ('${owner}','owner@example.com'),('${qa}','qa@example.com'),('${viewer}','viewer@example.com');
    insert into public.groups values ('g','${owner}'),('other','${owner}');
    insert into public.group_members values ('g','${qa}','qa'),('g','${viewer}','viewer');
    insert into public.projects(id,group_id,owner_id,name,sprint_no,created_at) values ('${project}','g','${owner}','Legacy','Sprint 41','2025-12-31T18:00:00Z');
    grant usage on schema public,private,auth to authenticated,anon;
    grant select,insert,update on public.projects to authenticated;
  `);
  await db.exec(productionFunction(accessSql, "private.can_manage_group"));
  await db.exec(productionFunction(accessSql, "private.can_manage_project"));
  await db.exec(productionFunction(globalSql, "private.can_access_group"));
  await db.exec(productionFunction(globalSql, "private.can_view_project"));
  await db.exec(`alter table public.projects enable row level security;
    create policy project_read on public.projects for select to authenticated using (private.can_view_project(id));
    create policy project_update on public.projects for update to authenticated using (private.can_manage_project(id)) with check (private.can_manage_project(id));
    create policy project_insert on public.projects for insert to authenticated with check (owner_id = auth.uid() and private.can_access_group(group_id));`);
  await db.exec(await readFile("supabase/migrations/20261001145040_years_sprints_project_history.sql", "utf8"));
  await t.test("legacy creation date uses Bangkok year and retains the project identity", async () => {
    const rows = (await db.query<{ id: string; year: number; name: string }>(`select p.id,y.year,s.name from projects p join sprints s on s.id=p.sprint_id join workspace_years y on y.id=s.year_id`)).rows;
    assert.deepEqual(rows, [{ id: project, year: 2026, name: "Sprint 41" }]);
  });
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${qa}';`);
  await t.test("QA creates a year and sprint while history cannot be forged", async () => {
    await db.exec(`insert into workspace_years(id,group_id,year,created_by) values ('20000000-0000-4000-8000-000000000001','g',2027,'${qa}');
      insert into sprints(id,year_id,group_id,name,created_by) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','g','Sprint 1','${qa}');`);
    await assert.rejects(db.exec(`insert into project_history(project_id,after_data) values ('${project}','{}')`), /permission denied/i);
    await assert.rejects(db.exec(`insert into workspace_years(group_id,year,created_by) values ('other',2028,'${qa}')`), /row-level security/i);
  });
  await db.exec(`set request.jwt.claim.sub = '${owner}';`);
  await t.test("editing and moving across years writes one before/after history entry", async () => {
    await db.exec(`update projects set name='Renamed',sprint_id='30000000-0000-4000-8000-000000000001' where id='${project}'`);
    const history = (await db.query<{ actor_email: string; before_data: { year: number; name: string }; after_data: { year: number; name: string } }>(`select actor_email,before_data,after_data from project_history where before_data is not null`)).rows;
    assert.equal(history.length, 1);
    assert.equal(history[0].actor_email, "owner@example.com");
    assert.equal(history[0].before_data.year, 2026);
    assert.equal(history[0].before_data.name, "Legacy");
    assert.equal(history[0].after_data.year, 2027);
    assert.equal(history[0].after_data.name, "Renamed");
    assert.equal((await db.query<{ sprint_no: string }>(`select sprint_no from projects`)).rows[0].sprint_no, "Sprint 1");
    await db.exec(`update projects set name='Renamed' where id='${project}'`);
    assert.equal((await db.query<{ count: number }>(`select count(*)::int as count from project_history`)).rows[0].count, 2);
  });
  await t.test("invalid target rolls back and cannot move to another group", async () => {
    await assert.rejects(db.exec(`update projects set sprint_id='30000000-0000-4000-8000-000000000099' where id='${project}'`), /Sprint must belong/);
    await assert.rejects(db.exec(`update projects set group_id='other' where id='${project}'`), /another Group/);
    assert.equal((await db.query<{ count: number }>(`select count(*)::int as count from project_history`)).rows[0].count, 2);
  });
  await db.exec(`set request.jwt.claim.sub = '${viewer}';`);
  await t.test("viewers can read history but cannot create years, edit projects or rewrite history", async () => {
    assert.equal((await db.query(`select * from project_history`)).rows.length, 2);
    await assert.rejects(db.exec(`insert into workspace_years(group_id,year,created_by) values ('g',2028,'${viewer}')`), /row-level security/);
    assert.equal((await db.query(`update projects set name='Forged' where id='${project}' returning id`)).rows.length, 0);
    await assert.rejects(db.exec(`delete from project_history`), /permission denied/);
  });
  await db.exec(`set role anon; set request.jwt.claim.sub = '';`);
  await t.test("anonymous callers cannot read planning data or call approval summary", async () => {
    await assert.rejects(db.exec(`select * from workspace_years`), /permission denied/);
    await assert.rejects(db.exec(`select * from sprint_approval_counts('30000000-0000-4000-8000-000000000001')`), /permission denied/);
  });
  await db.exec(`reset role; set request.jwt.claim.sub = '';
    create function private.can_edit_project(requested_project_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.can_manage_project(requested_project_id) or (private.has_app_access() and exists(select 1 from public.projects p join public.group_members gm on gm.group_id=p.group_id where p.id=requested_project_id and gm.user_id=auth.uid() and gm.role='qa')) $$;
    grant select,insert,update on test_executions to authenticated;
    insert into test_cases values ('40000000-0000-4000-8000-000000000001','${project}','TC-01');
    insert into test_executions(id,project_id,test_case_id,status,result_reference) values ('50000000-0000-4000-8000-000000000001','${project}','40000000-0000-4000-8000-000000000001','Pass','qa-results:{"results":[{"id":"legacy","status":"Pass"}]}');`);
  // Reproduce existing planning metadata without a completed dashboard rollout.
  await db.exec(`alter table sprints add column goal text not null default '', add column status text not null default 'Planned', add column updated_at timestamptz not null default now();
    alter table projects add column last_move_reason text not null default '';
    update sprints set goal='Existing goal';`);
  await db.exec(await readFile("supabase/migrations/20261002030018_sprint_dashboard_origins_and_moves.sql", "utf8"));
  assert.equal((await db.query<{goal:string}>(`select goal from sprints limit 1`)).rows[0].goal, 'Existing goal');
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`);
  await t.test("Sprint edits use optimistic concurrency and immutable history", async () => {
    const version = (await db.query<{ updated_at: string }>(`select updated_at::text from sprints where id='30000000-0000-4000-8000-000000000001'`)).rows[0].updated_at;
    await db.query(`select * from update_sprint('30000000-0000-4000-8000-000000000001','Sprint 1 edited','2027-01-01','2027-01-14','Release readiness','Active',$1::timestamptz)`, [version]);
    assert.equal((await db.query<{ sprint_no: string }>(`select sprint_no from projects`)).rows[0].sprint_no, 'Sprint 1 edited');
    assert.equal((await db.query(`select * from sprint_history`)).rows.length, 1);
    await assert.rejects(db.query(`select * from update_sprint('30000000-0000-4000-8000-000000000001','Stale',null,null,'','Active',$1::timestamptz)`, [version]), /changed/i);
    await assert.rejects(db.exec(`delete from sprint_history`), /permission denied/i);
  });
  await t.test("multiple QA responsibility does not grant write capability and is audited", async () => {
    await db.exec(`select set_project_qa('${project}',array['${qa}','${owner}']::uuid[]);`);
    assert.equal((await db.query(`select * from project_qa_assignments`)).rows.length, 2);
    await assert.rejects(db.exec(`select set_project_qa('${project}',array['${viewer}']::uuid[])`), /QA member/i);
    await db.exec(`set request.jwt.claim.sub = '${viewer}';`);
    await assert.rejects(db.exec(`select set_project_qa('${project}',array['${qa}']::uuid[])`), /Permission denied/i);
    await db.exec(`set request.jwt.claim.sub = '${owner}';`);
  });
  await t.test("original author and Sprint survive move, edit, delete and re-add", async () => {
    await db.exec(`set request.jwt.claim.sub = '${qa}'; update test_executions set result_reference='qa-results:{"results":[{"id":"r1","status":"Failed","actualResult":"failed"},{"id":"imported","sourceSheetName":"RC TC-01","status":"Pass"}]}'`);
    const origin = (await db.query<{ origin: { sprintId: string; authorId: string; inferred: boolean } }>(`select (substring(result_reference from 12)::jsonb->'results'->0->'origin') as origin from test_executions`)).rows[0].origin;
    assert.equal(origin.sprintId, '30000000-0000-4000-8000-000000000001');
    assert.equal(origin.authorId, qa);
    assert.equal(origin.inferred, false);
    await db.exec(`set request.jwt.claim.sub = '${owner}';`);
    const target = (await db.query<{ id: string }>(`select id from sprints where name='Sprint 41'`)).rows[0].id;
    await assert.rejects(db.exec(`update projects set sprint_id='${target}' where id='${project}'`), /reason/i);
    await db.exec(`update projects set sprint_id='${target}',last_move_reason='Carry over defect' where id='${project}'`);
    const history = (await db.query<{ after_data: { moveSnapshot: { totalCases: number; failed: number }; reason: string } }>(`select after_data from project_history where after_data->>'reason'='Carry over defect'`)).rows[0].after_data;
    assert.equal(history.reason, 'Carry over defect'); assert.equal(history.moveSnapshot.totalCases, 1); assert.equal(history.moveSnapshot.failed, 0); // Case status remains Pass independently of r1.
    await db.exec(`update test_executions set result_reference='qa-results:{"results":[{"id":"r1","status":"Pass","origin":{"sprintId":"${target}","authorId":"${owner}"}}]}'`);
    const stamped = (await db.query<{ origin: typeof origin }>(`select (substring(result_reference from 12)::jsonb->'results'->0->'origin') as origin from test_executions`)).rows[0].origin;
    assert.deepEqual(stamped, origin);
    await db.exec(`update test_executions set result_reference='qa-results:{"results":[]}'; update test_executions set result_reference='qa-results:{"results":[{"id":"r1","status":"Pass"}]}'`);
    assert.deepEqual((await db.query<{ origin: typeof origin }>(`select (substring(result_reference from 12)::jsonb->'results'->0->'origin') as origin from test_executions`)).rows[0].origin, origin);
    await db.exec(`update test_executions set result_reference='qa-results:{"results":[{"id":"r1","status":"Pass"},{"id":"r2","status":"Pass"}]}'`);
    assert.equal((await db.query<{ sprint_id: string }>(`select sprint_id from result_origins where result_id='r2'`)).rows[0].sprint_id, target);
    const legacy = (await db.query<{ inferred: boolean; author_id: string | null }>(`select inferred,author_id from result_origins where result_id='legacy'`)).rows[0];
    assert.deepEqual(legacy, { inferred: true, author_id: null });
    await assert.rejects(db.exec(`update result_origins set author_id='${owner}'`), /permission denied/i);
  });
  await t.test("viewers cannot edit Sprint or invoke mutations and anonymous cannot read origins", async () => {
    await db.exec(`set request.jwt.claim.sub = '${viewer}';`);
    await assert.rejects(db.exec(`select * from update_sprint('30000000-0000-4000-8000-000000000001','Forged',null,null,'','Active',now())`), /Permission denied/i);
    await db.exec(`set role anon; set request.jwt.claim.sub = '';`);
    await assert.rejects(db.exec(`select * from result_origins`), /permission denied/i);
    await assert.rejects(db.exec(`select set_project_qa('${project}',array[]::uuid[])`), /permission denied/i);
  });
  await t.test("dashboard migration can be rerun without losing audit or origin records", async () => {
    await db.exec(`reset role; set request.jwt.claim.sub = '';`);
    const before = (await db.query(`select (select count(*) from sprint_history) as audits,(select count(*) from project_history) as moves,(select jsonb_agg(to_jsonb(r) order by result_id) from result_origins r) as origins`)).rows;
    await db.exec(await readFile("supabase/migrations/20261002030018_sprint_dashboard_origins_and_moves.sql", "utf8"));
    const after = (await db.query(`select (select count(*) from sprint_history) as audits,(select count(*) from project_history) as moves,(select jsonb_agg(to_jsonb(r) order by result_id) from result_origins r) as origins`)).rows;
    assert.deepEqual(after, before);
  });
  await t.test('Sprint defect totals count closed and open from the latest attempt',async()=>{
    await db.exec('grant delete on public.groups,public.projects to authenticated;');
    await db.exec(await readFile('supabase/migrations/20261002034634_sprint_defect_totals.sql','utf8'));
    await db.exec(`update test_executions set result_reference='qa-results:{"defects":[{"status":"Closed"},{"status":"Passed"},{"status":"Open"}]}';`);
    const snapshot=(await db.query<{snapshot:{closedDefects:number;totalDefects:number;openDefects:number}}>(`select private.project_move_snapshot('${project}') as snapshot`)).rows[0].snapshot;
    assert.equal(snapshot.closedDefects,2);assert.equal(snapshot.totalDefects,3);assert.equal(snapshot.openDefects,1);
    await db.exec(await readFile('supabase/migrations/20261002034634_sprint_defect_totals.sql','utf8'));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
    await assert.rejects(db.exec(`delete from projects where id='${project}'`),/permission denied/i);
    await assert.rejects(db.exec(`delete from groups where id='other'`),/permission denied/i);
  });
  await t.test('new web results in a source tab retain real origins and legacy imported tester does not become the next editor',async()=>{
    await db.exec(`reset role;alter table test_cases add column case_name text default '';create table private.app_authorizations(email text primary key,enabled boolean,user_type text);create table private.system_owners(user_id uuid primary key);
      insert into private.app_authorizations values ('owner@example.com',true,'qa'),('qa@example.com',true,'qa');`);
    await db.exec(await readFile('supabase/migrations/20261002042833_personal_test_performance.sql','utf8'));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${qa}';
      update test_executions set executed_by_name='Imported Tester',result_reference='qa-results:{"results":[{"id":"import-freeze","sourceSheetName":"RC TC-01","status":"Pass"}]}';
      update test_executions set executed_by_name='Next Editor',result_reference='qa-results:{"results":[{"id":"import-freeze","sourceSheetName":"RC TC-01","status":"Pass"},{"id":"new-tab-web","source":"web","testerName":"QA","sourceSheetName":"RC TC-01","status":"Pass"}]}';`);
    const origins=(await db.query<{author_id:string;inferred:boolean}>(`select author_id,inferred from result_origins where result_id='new-tab-web'`)).rows[0];
    assert.deepEqual(origins,{author_id:qa,inferred:false});
    const payload=(await db.query<{payload:{results:{id:string;testerName:string}[]}}>(`select substring(result_reference from 12)::jsonb as payload from test_executions`)).rows[0].payload;
    assert.equal(payload.results.find(r=>r.id==='import-freeze')?.testerName,'Imported Tester');
  });
});
