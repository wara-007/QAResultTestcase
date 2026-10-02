import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Sprint snapshots include the latest Defected register without duplicating web Jira defects", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const project = "10000000-0000-4000-8000-000000000001";
  await db.exec(`create role anon; create role authenticated; create schema private;
    create table test_cases(id uuid primary key, project_id uuid, testcase_key text);
    create table test_executions(id uuid primary key, test_case_id uuid, attempt_no integer,status text,result_reference text);
    create table source_files(id uuid primary key default gen_random_uuid(),project_id uuid,version_no integer,column_mapping jsonb);
    create table project_qa_assignments(project_id uuid,user_id uuid);
    create function private.result_payload(value text) returns jsonb language sql as $$ select substring(value from 12)::jsonb $$;
    insert into test_cases values ('20000000-0000-4000-8000-000000000001','${project}','TC-01');
    insert into test_executions values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'Pass','qa-results:{"defects":[{"id":"web-id","status":"Open","jiraUrl":"https://jira/BUG-1"},{"id":"web-only","status":"Open"}]}');
    insert into source_files(project_id,version_no,column_mapping) values ('${project}',1,'{"sheets":[{"name":"Defected","defects":[{"id":"old","status":"Open"}]}]}'),
      ('${project}',2,'{"sheets":[{"name":"Defected","defects":[{"id":"DEF-01","status":"Passed","jiraUrl":"https://jira/BUG-1"},{"id":"DEF-02","status":"Closed"}]}]}');`);
  const sql = await readFile("supabase/migrations/20261002121258_project_defect_register_totals.sql", "utf8");
  await db.exec(sql);
  const counts = (await db.query<{snapshot:Record<string,number>}>(`select private.project_move_snapshot('${project}') as snapshot`)).rows[0].snapshot;
  assert.equal(counts.totalCases, 1);
  assert.equal(counts.totalDefects, 3);
  assert.equal(counts.closedDefects, 2);
  assert.equal(counts.openDefects, 1);
  await db.exec(sql);
  const rerun = (await db.query<{snapshot:Record<string,number>}>(`select private.project_move_snapshot('${project}') as snapshot`)).rows[0].snapshot;
  assert.deepEqual(rerun, counts);
  await db.exec("set role authenticated");
  await assert.rejects(db.query(`select private.project_move_snapshot('${project}')`), /permission denied/i);
});
