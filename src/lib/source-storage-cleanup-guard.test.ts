import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('cleanup excludes live source/reference writers, allows only token-bound finalization, and releases normally',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema private;
 create table source_files(id uuid primary key,storage_key text,byte_size bigint,column_mapping jsonb);
 create table test_cases(id uuid primary key);create table test_executions(id uuid);create table export_jobs(id uuid);
 create table projects(id uuid);create table project_sprint_snapshots(id uuid);create table project_sprint_snapshot_cases(id uuid);
 create table project_history(id uuid);create table project_approval_requests(id uuid);`);
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261025173907_source_storage_cleanup_guard.sql',import.meta.url),'utf8'));
 const token='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002',source='20000000-0000-0000-0000-000000000001';
 await db.exec(`insert into source_files values('${source}','project/source/book.xlsx',10,'{}');select qa_source_storage_cleanup_begin('${token}');`);
 for(const table of ['source_files','test_cases','test_executions','export_jobs','projects','project_sprint_snapshots','project_sprint_snapshot_cases','project_history','project_approval_requests'])await assert.rejects(db.exec(`delete from ${table} where true;`),/กำลังจัดพื้นที่/);
 await assert.rejects(db.exec(`select qa_source_storage_cleanup_begin('${other}');`),/already running/);
 await assert.rejects(db.exec(`select qa_source_storage_cleanup_finish('${other}','${source}','project/source/book.xlsx',10);`),/Invalid cleanup lease/);
 await db.exec(`select qa_source_storage_cleanup_renew('${token}');`);
 await db.exec(`select qa_source_storage_cleanup_finish('${token}','${source}','project/source/book.xlsx',10);`);
 const saved=await db.query<{storage_key:string;byte_size:number}>('select storage_key,byte_size from source_files');
 assert.equal(saved.rows[0].storage_key,'');assert.equal(Number(saved.rows[0].byte_size),0);
 await db.exec(`update private.source_storage_cleanup_lease set expires_at=now()-interval '1 second';`);
 await assert.rejects(db.exec(`select qa_source_storage_cleanup_renew('${token}');`),/Invalid cleanup lease/);
 await db.exec(`delete from private.source_storage_cleanup_lease`);
 await assert.rejects(db.exec(`select qa_source_storage_cleanup_renew('${token}');`),/Invalid cleanup lease/);
 await db.exec(`select qa_source_storage_cleanup_end('${token}');insert into test_cases values('${source}');`);
 await db.exec('set role authenticated');await assert.rejects(db.exec(`select qa_source_storage_cleanup_begin('${token}');`),/permission denied/);
 } finally {await db.close();}
});
