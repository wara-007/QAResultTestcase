import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const owner='00000000-0000-4000-8000-000000000001', qa='00000000-0000-4000-8000-000000000002', viewer='00000000-0000-4000-8000-000000000003';
const project='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002';
const caseId='20000000-0000-4000-8000-000000000001', otherCase='20000000-0000-4000-8000-000000000002', sprint='30000000-0000-4000-8000-000000000001';
test('personal performance migration scopes assignments and returns only lightweight result metadata',async(t)=>{
  const db=new PGlite(); t.after(()=>db.close());
  await db.exec(`create role anon;create role authenticated;create schema private;create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table private.app_authorizations(email text primary key,enabled boolean,user_type text);
    create table private.system_owners(user_id uuid primary key);
    create table groups(id text primary key,owner_id uuid);
    create table group_members(group_id text,user_id uuid,role text);
    create table profiles(id uuid primary key,display_name text);
    create table projects(id uuid primary key,group_id text,sprint_id uuid,name text);
    create table test_cases(id uuid primary key,project_id uuid references projects on delete cascade,testcase_key text,case_name text);
    create table test_executions(id uuid primary key default gen_random_uuid(),test_case_id uuid references test_cases on delete cascade,attempt_no int,status text,result_reference text,executed_by_name text,created_at timestamptz default now());
    create table result_origins(project_id uuid,test_case_id uuid,result_id text,source_sheet text,sprint_id uuid,author_id uuid,author_name text,inferred boolean,active boolean);
    create function private.can_view_project(requested_project_id uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.projects where id=requested_project_id)$$;
    create function private.can_edit_project(requested_project_id uuid) returns boolean language sql stable security definer as $$select auth.uid()='${owner}' or auth.uid()='${qa}'$$;
    create function private.can_access_group(requested_group_id text) returns boolean language sql stable security definer as $$select auth.uid() is not null$$;
    create function private.result_payload(reference text) returns jsonb language plpgsql immutable as $$begin if reference not like 'qa-results:%' then return '{}'::jsonb;end if;return substring(reference from 12)::jsonb;exception when others then return '{}'::jsonb;end$$;
    insert into auth.users values ('${owner}','owner@example.com'),('${qa}','qa@example.com'),('${viewer}','viewer@example.com');
    insert into private.app_authorizations values ('owner@example.com',true,'qa'),('qa@example.com',true,'qa'),('viewer@example.com',true,'qa');
    insert into groups values ('g','${owner}');insert into group_members values ('g','${qa}','qa'),('g','${viewer}','viewer');
    insert into projects values ('${project}','g','${sprint}','Project'),('${other}','g','${sprint}','Other');
    insert into test_cases values ('${caseId}','${project}','TC-18','Checkout'),('${otherCase}','${other}','TC-01','Other');
    insert into test_executions(test_case_id,attempt_no,status,executed_by_name,result_reference) values ('${caseId}',1,'Pass','Legacy Tester','qa-results:{"results":[{"id":"r1","status":"Pass","testerName":"QA","actualResult":"secret long text","evidence":[{"url":"secret image"}],"sourceSheetName":"RC TC-18"}]}');
    grant usage on schema public,private,auth to authenticated,anon;
    grant select on test_cases to authenticated;`);
  const sql=await readFile('supabase/migrations/20261002042833_personal_test_performance.sql','utf8');
  await db.exec(sql);await db.exec(`set role authenticated;set request.jwt.claim.sub='${qa}';`);
  await t.test('editors assign two people and clear only selected source rows',async()=>{
    await db.query(`select set_test_case_qa($1,array[$2]::uuid[],array[$3,$4]::uuid[],array['RC TC-18'])`,[project,caseId,owner,qa]);
    assert.equal((await db.query('select * from test_case_qa_assignments')).rows.length,2);
    await db.query(`select set_test_case_qa($1,array[$2]::uuid[],array[$3]::uuid[],array[''])`,[project,caseId,qa]);
    await db.query(`select set_test_case_qa($1,array[$2]::uuid[],array[]::uuid[],array['RC TC-18'])`,[project,caseId]);
    assert.equal((await db.query('select * from test_case_qa_assignments')).rows.length,1);
  });
  await t.test('wrong Project, viewer assignee and empty selection fail without partial changes',async()=>{
    await assert.rejects(db.query(`select set_test_case_qa($1,array[$2,$3]::uuid[],array[$4]::uuid[])`,[project,caseId,otherCase,qa]),/Project/i);
    await assert.rejects(db.query(`select set_test_case_qa($1,array[$2]::uuid[],array[$3]::uuid[])`,[project,caseId,viewer]),/eligible/i);
    await assert.rejects(db.query(`select set_test_case_qa($1,array[]::uuid[],array[$2]::uuid[])`,[project,qa]),/selection/i);
    assert.equal((await db.query('select * from test_case_qa_assignments')).rows.length,1);
  });
  await t.test('viewers cannot mutate or write the assignment table directly',async()=>{
    await db.exec(`set request.jwt.claim.sub='${viewer}';`);
    await assert.rejects(db.query(`select set_test_case_qa($1,array[$2]::uuid[],array[$3]::uuid[])`,[project,caseId,qa]),/Permission denied/i);
    await assert.rejects(db.exec(`delete from test_case_qa_assignments`),/permission denied/i);
    await db.exec(`set request.jwt.claim.sub='${qa}';`);
  });
  await t.test('revoked accounts cannot receive new assignments',async()=>{
    await db.exec(`reset role;update private.app_authorizations set enabled=false where email='owner@example.com';set role authenticated;`);
    await assert.rejects(db.query(`select set_test_case_qa($1,array[$2]::uuid[],array[$3]::uuid[])`,[project,caseId,owner]),/eligible/i);
  });
  await t.test('metadata strips evidence and long result content and anonymous cannot read it',async()=>{
    const rows=(await db.query<{results:Record<string,unknown>[]}>(`select * from personal_sprint_cases('${sprint}')`)).rows;
    assert.equal(rows.length,2);assert.equal(rows[0].results.length+rows[1].results.length,1);
    assert.equal(JSON.stringify(rows).includes('secret'),false);
    await db.exec(`set role anon;set request.jwt.claim.sub='';`);
    await assert.rejects(db.exec(`select * from personal_sprint_cases('${sprint}')`),/permission denied/i);
  });
  await t.test('serialized empty results retains base execution status and tester',async()=>{
    await db.exec(`reset role;insert into test_executions(test_case_id,attempt_no,status,executed_by_name,result_reference) values ('${otherCase}',1,'Pass','Ann','qa-results:{"results":[]}');set role authenticated;set request.jwt.claim.sub='${qa}';`);
    const rows=(await db.query<{testcase_key:string;results:{status:string;testerName:string}[]}>(`select * from personal_sprint_cases('${sprint}')`)).rows;
    assert.equal(rows.find(row=>row.testcase_key==='TC-01')?.results[0]?.status,'Pass');
    assert.equal(rows.find(row=>row.testcase_key==='TC-01')?.results[0]?.testerName,'Ann');
  });
  await t.test('rerun preserves assignments',async()=>{
    await db.exec('reset role;');await db.exec(sql);
    assert.equal((await db.query('select * from test_case_qa_assignments')).rows.length,1);
  });
});
