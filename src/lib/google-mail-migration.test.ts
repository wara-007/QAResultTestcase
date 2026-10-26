import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("mail credentials are isolated per QA, cannot change ownership, and migration is rerunnable", async t => {
  const db = new PGlite(); t.after(() => db.close());
  const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${a}'),('${b}');
    grant usage on schema public,auth to authenticated,anon;`);
  const sql = await readFile("supabase/migrations/20261020040954_qa_gmail_connections.sql", "utf8");
  await db.exec(sql); await db.exec(sql);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}'; insert into google_mail_connections(user_id,token_ciphertext) values ('${a}','encrypted-a');`);
  await assert.rejects(db.exec(`insert into google_mail_connections(user_id,token_ciphertext) values ('${b}','forged')`), /row.level security/i);
  await assert.rejects(db.exec(`update google_mail_connections set user_id='${b}' where user_id='${a}'`), /row.level security/i);
  await db.exec(`set request.jwt.claim.sub='${b}';`);
  assert.equal((await db.query("select * from google_mail_connections")).rows.length, 0);
  await db.exec(`update google_mail_connections set token_ciphertext='stolen' where user_id='${a}'; delete from google_mail_connections where user_id='${a}'; set request.jwt.claim.sub='${a}';`);
  assert.equal((await db.query<{token_ciphertext:string}>("select token_ciphertext from google_mail_connections")).rows[0].token_ciphertext, "encrypted-a");
  await db.exec("reset role; set role anon;");
  await assert.rejects(db.query("select * from google_mail_connections"), /permission denied/i);
});
