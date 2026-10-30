import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const project = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const qa = "00000000-0000-4000-8000-000000000001";
const otherQa = "00000000-0000-4000-8000-000000000002";
const first = "30000000-0000-4000-8000-000000000001";
const second = "30000000-0000-4000-8000-000000000002";
const draft = {senderEmail: "qa@truecorp.co.th", recipientEmail: "po@example.com", cc: [], subject: "Review", body: "ผลทดสอบ\nhttps://qa.example.com/approvals/one"};

test("manual delivery migration persists versions and confirms only the current authorized workflow atomically", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key); create table public.projects(id uuid primary key);
    insert into auth.users values ('${qa}'),('${otherQa}'); insert into projects values ('${project}');`);
  await db.exec(await readFile("supabase/migrations/20260913083548_project_approval_requests.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20260918173234_deduplicate_project_approvals.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261030022400_project_approval_manual_deliveries.sql", "utf8"));
  const request = (deliveryId: string, repeat = false) => ({id: requestId, project_id: project, recipient_email: "po@example.com", token_hash: "a".repeat(64), expires_at: "2030-01-01T00:00:00Z", requested_at: repeat ? "2026-10-30T03:00:00Z" : "2026-10-30T02:00:00Z", requested_by: qa, requested_by_name: "QA One", email_id: `${repeat ? "manual-update" : "manual"}:${deliveryId}`});
  const prepare = (value: ReturnType<typeof request>, existing: unknown, id: string, content: unknown = draft) => db.query<Record<string, unknown>>("select * from public.prepare_project_approval_manual_delivery($1::jsonb,$2::jsonb,$3::uuid,$4::jsonb)", [JSON.stringify(value), existing === null ? null : JSON.stringify(existing), id, JSON.stringify(content)]);
  const confirm = (id = first, projectId = project, user = qa, name = "QA One") => db.query<Record<string, unknown>>("select * from public.confirm_project_approval_manual_delivery($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text)", [projectId, requestId, id, user, name]);

  await t.test("prepare stores complete draft without provider receipt", async () => {
    const result = await prepare(request(first), null, first);
    assert.equal(result.rows[0].email_id, `manual:${first}`);
    assert.equal(result.rows[0].email_sent_at, null);
    const saved = (await db.query<Record<string, unknown>>("select * from project_approval_manual_deliveries")).rows[0];
    assert.deepEqual(saved.draft, draft);
    assert.equal(saved.prepared_by, qa);
    assert.equal(saved.confirmed_at, null);
  });
  await t.test("confirmation retains PO decision and repeated confirmations retain first actor and time", async () => {
    await db.exec(`update project_approval_requests set status='approved', reviewed_at='2026-10-30T02:30:00Z', reviewer_name='PO', reviewer_comment='OK' where id='${requestId}'`);
    const result = (await confirm()).rows[0];
    assert.ok(result.confirmed_at);
    assert.equal(result.confirmed_by, qa);
    assert.equal(result.confirmed_by_name, "QA One");
    const repeated = (await confirm(first, project, otherQa, "QA Two")).rows[0];
    assert.equal(String(repeated.confirmed_at), String(result.confirmed_at));
    assert.equal(repeated.confirmed_by, qa);
    const approval = (await db.query<Record<string, unknown>>("select * from project_approval_requests")).rows[0];
    assert.equal(approval.status, "approved");
    assert.equal(approval.reviewer_comment, "OK");
    assert.equal(approval.email_sent_at, null);
  });
  await t.test("new preparation preserves link/decision and starts a distinct unconfirmed delivery", async () => {
    const previous = (await db.query<Record<string, unknown>>("select requested_at, email_id from project_approval_requests")).rows[0];
    const result = (await prepare(request(second, true), previous, second)).rows[0];
    assert.equal(result.status, "approved");
    assert.equal(result.reviewer_comment, "OK");
    assert.equal(result.token_hash, "a".repeat(64));
    assert.equal(result.email_id, `manual-update:${second}`);
    const history = (await db.query<Record<string, unknown>>("select * from project_approval_manual_deliveries order by prepared_at")).rows;
    assert.equal(history.length, 2);
    assert.ok(history[0].confirmed_at);
    assert.equal(history[1].confirmed_at, null);
  });
  await t.test("stale, foreign-project and revoked confirmations are rejected", async () => {
    await assert.rejects(confirm(first), /รอบ|เปลี่ยนแปลง/);
    await assert.rejects(confirm(second, "10000000-0000-4000-8000-000000000099"), /รอบ|เปลี่ยนแปลง/);
    await db.exec(`update project_approval_requests set status='revoked' where id='${requestId}'`);
    await assert.rejects(confirm(second), /ยกเลิก|เปลี่ยนแปลง/);
    await db.exec(`update project_approval_requests set status='approved' where id='${requestId}'`);
  });
  await t.test("failed persistence rolls back request updates and stale preparation cannot overwrite current round", async () => {
    const previous = (await db.query<Record<string, unknown>>("select requested_at, email_id from project_approval_requests")).rows[0];
    const third = "30000000-0000-4000-8000-000000000003";
    await assert.rejects(prepare(request(third, true), previous, third, {body: "invalid"}));
    assert.deepEqual((await db.query<Record<string, unknown>>("select requested_at, email_id from project_approval_requests")).rows[0], previous);
    assert.equal((await db.query<Record<string, unknown>>("select count(*)::int as n from project_approval_manual_deliveries")).rows[0].n, 2);
    await assert.rejects(prepare(request(third, true), {requested_at: "2026-10-30T02:00:00Z", email_id: `manual:${first}`}, third), /เปลี่ยนแปลง/);
  });
  await t.test("browser roles cannot read drafts or execute either server-only function", async () => {
    const permissions = (await db.query<Record<string, unknown>>(`select relrowsecurity from pg_class where oid='public.project_approval_manual_deliveries'::regclass`)).rows[0];
    assert.equal(permissions.relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query<Record<string, unknown>>("select * from project_approval_manual_deliveries"), /permission denied/);
      await assert.rejects(confirm(second), /permission denied/);
      await assert.rejects(prepare(request(first), null, first), /permission denied/);
      await db.exec("reset role");
    }
  });
  await t.test("trusted service role can call confirmation with invoker rights", async () => {
    await db.exec("set role service_role");
    assert.ok((await confirm(second)).rows[0].confirmed_at);
    await db.exec("reset role");
  });
});
