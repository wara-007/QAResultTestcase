import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('all actual group members have equal mutation rights, outsiders remain read only',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function private.has_app_access() returns boolean language sql stable as $$ select coalesce(current_setting('test.enabled',true),'true')='true' $$;
    create function private.is_system_owner() returns boolean language sql stable as $$ select coalesce(current_setting('test.owner',true),'false')='true' $$;
    create table groups(id text primary key,owner_id uuid);
    create table group_members(group_id text,user_id uuid,role text);
    create table projects(id uuid primary key,group_id text,owner_id uuid,name text);
    create table sprints(id uuid primary key,group_id text,created_by uuid);
    create function private.can_view_project(uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.has_app_access() and exists(select 1 from public.projects where id=$1) $$;
    insert into groups values('g','00000000-0000-4000-8000-000000000001');
    insert into projects values('10000000-0000-4000-8000-000000000001','g','00000000-0000-4000-8000-000000000001','Original');
    insert into sprints values('20000000-0000-4000-8000-000000000001','g','00000000-0000-4000-8000-000000000001');
    insert into group_members values('g','00000000-0000-4000-8000-000000000002','qa'),('g','00000000-0000-4000-8000-000000000003','viewer');
    grant usage on schema public,private,auth to authenticated,anon;
    grant select,update on projects to authenticated;
  `);
  const migration=await readFile('supabase/migrations/20261009123224_equal_group_member_access.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  await db.exec(`alter table projects enable row level security;
    create policy project_read on projects for select to authenticated using(private.can_view_project(id));
    create policy project_edit on projects for update to authenticated using(private.can_manage_project(id)) with check(private.can_manage_project(id));
    set role authenticated;`);
  for(const suffix of ['2','3']){
    await db.exec(`set request.jwt.claim.sub='00000000-0000-4000-8000-00000000000${suffix}';`);
    const row=(await db.query(`select private.can_manage_group('g') as manage,private.can_plan_group('g') as plan,private.can_manage_sprint('20000000-0000-4000-8000-000000000001') as sprint,can_edit,can_manage,can_delete from list_project_access('g')`)).rows[0];
    assert.deepEqual(row,{manage:true,plan:true,sprint:true,can_edit:true,can_manage:true,can_delete:true});
    assert.equal((await db.query(`update projects set name='Member edit' returning id`)).rows.length,1);
    await assert.rejects(db.exec(`delete from projects`),/permission denied/i);
  }
  await db.exec(`set request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';`);
  assert.deepEqual((await db.query(`select can_view,can_edit,can_manage,can_delete from list_project_access('g')`)).rows[0],{can_view:true,can_edit:false,can_manage:false,can_delete:false});
  assert.equal((await db.query(`update projects set name='Outsider edit' returning id`)).rows.length,0);
  await db.exec(`set test.enabled='false'; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';`);
  assert.equal((await db.query<{allowed:boolean}>(`select private.can_manage_group('g') as allowed`)).rows[0].allowed,false);
  assert.equal((await db.query(`select * from list_project_access('g')`)).rows.length,0);
  await db.exec(`reset role; set role anon;`);
  await assert.rejects(db.exec(`select private.can_manage_group('g')`),/permission denied/i);
});
