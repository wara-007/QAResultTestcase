import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function approvalAction(options: {existing?: Record<string, unknown>; accessError?: boolean; evidenceError?: boolean; writeError?: boolean} = {}) {
  const calls: string[] = [];
  const writes: Record<string, unknown>[] = [];
  let row: Record<string, unknown> = options.existing ?? {};
  const db = {from(table: string) {
    const builder = {
      select() {return builder;}, eq() {return builder;}, neq() {return builder;},
      async maybeSingle() {return {error: null, data: table === "projects" ? {id: "project", name: "Checkout", google_sheet_url: "https://docs.google.com/test"} : options.existing ?? null};},
      insert(value: Record<string, unknown>) {writes.push(value); row = {...row, ...value}; return builder;},
      update(value: Record<string, unknown>) {writes.push(value); row = {...row, ...value}; return builder;},
      async single() {return {error: options.writeError ? {message: "Write failed"} : null, data: row};},
    }; return builder;
  }};
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const action = {exports: {} as typeof import("../app/actions")};
  runInNewContext(compiled, {exports: action.exports, module: action, Error, process: {env: {NEXT_PUBLIC_SITE_URL: "https://qa.example.com"}}, require(id: string) {
    if (id === "@/lib/project-access-server") return {requireProjectCapability: async () => {
      calls.push("access"); if (options.accessError) throw new Error("No access");
      return {userId: "qa-user", claims: {email: "login@gmail.com", user_metadata: {name: "QA"}}, project: {google_sheet_id: "sheet"}};
    }};
    if (id === "@/lib/approval-evidence-server") return {requireApprovalEvidenceReady: async () => {
      calls.push("evidence"); if (options.evidenceError) throw new Error("Missing evidence");
    }};
    if (id === "@/lib/supabase/admin") return {createAdminClient: () => {calls.push("database"); return db;}};
    if (id === "@/lib/qa-mail-server") return {
      getQaMailSender: async () => {calls.push("provider"); throw new Error("No Microsoft setup");},
      qaMailPreparationFailure: () => ({message: "Connect mailbox", reauthorize: true}),
    };
    if (id === "@/lib/project-review") return {hashReviewToken: () => "new-token-hash"};
    if (id === "next/cache") return {revalidatePath: () => {}};
    if (["@/lib/mail-provider", "@/lib/approval-email", "@/lib/approval-notification"].includes(id)) return localRequire(`./${id.slice("@/lib/".length)}`);
    if (id === "node:crypto") return localRequire(id);
    return {};
  }});
  return {create: action.exports.createProjectApprovalRequest, calls, writes};
}
const input = {deliveryMode: "outlook" as const, projectId: "project", senderEmail: "qa@truecorp.co.th", recipientEmail: " PO@Example.com ", cc: "lead@example.com;lead@example.com", subject: "ผลทดสอบ", body: "เรียน PO,\nPass: 2", note: "", environment: "UAT", counts: {total: 2, pass: 2, failed: 0, skip: 0, notStart: 0, inProgress: 0}};

test("Outlook mode creates review and complete draft without Microsoft setup, OAuth or delivery", async () => {
  const fixture = approvalAction();
  const result = await fixture.create(input);
  assert.ok("request" in result, JSON.stringify(result));
  assert.ok(result.outlookDraft);
  assert.equal(result.outlookDraft.senderEmail, "qa@truecorp.co.th");
  assert.equal(result.outlookDraft.recipientEmail, "po@example.com");
  assert.deepEqual(Array.from(result.outlookDraft.cc), ["lead@example.com"]);
  assert.equal(result.outlookDraft.subject, "ผลทดสอบ");
  assert.match(result.outlookDraft.body, /เรียน PO,/);
  assert.ok(result.outlookDraft.body.includes(`https://qa.example.com/approvals/${result.request.id}`));
  assert.match(result.outlookDraft.body, /https:\/\/docs.google.com\/test/);
  assert.equal(result.request.emailId, "mailto");
  assert.equal(result.request.emailSentAt, "");
  assert.deepEqual(fixture.calls, ["access", "evidence", "database"]);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].requested_by, "qa-user");
  assert.equal(fixture.writes[0].email_sent_at, null);
});

test("preparing an update preserves PO decision, comments and original review link", async () => {
  const fixture = approvalAction({existing: {id: "original", status: "approved", requested_at: "2026-09-01", email_id: "mailto", email_sent_at: null, token_hash: "old-token", reviewed_at: "2026-09-02", reviewer_name: "PO", reviewer_comment: "OK", recipient_email: "po@example.com"}});
  const result = await fixture.create(input);
  assert.ok("request" in result);
  assert.equal(result.request.id, "original");
  assert.equal(result.request.status, "approved");
  assert.equal(result.request.reviewerComment, "OK");
  assert.equal(result.request.emailId, "mailto-update");
  assert.ok(result.outlookDraft?.body.includes("https://qa.example.com/approvals/original"));
  for (const key of ["status", "token_hash", "reviewed_at", "reviewer_name", "reviewer_comment"]) assert.equal(key in fixture.writes[0], false);
});

test("manual drafts retain access, evidence, revoked-request and write-failure checks", async () => {
  for (const options of [{accessError: true}, {evidenceError: true}, {existing: {id: "old", status: "revoked"}}, {writeError: true}]) {
    const fixture = approvalAction(options);
    const result = await fixture.create(input);
    assert.ok("error" in result);
    assert.equal("outlookDraft" in result, false);
    assert.equal(fixture.calls.includes("provider"), false);
    if (!options.writeError) assert.equal(fixture.writes.length, 0);
  }
});

test("invalid drafts never create a request and unrecognized delivery modes cannot bypass OAuth", async () => {
  for (const change of [{recipientEmail: "bad"}, {cc: "bad\r\nbcc:evil@example.com"}, {senderEmail: "qa@gmail.com"}, {deliveryMode: "unknown"}]) {
    const fixture = approvalAction();
    const result = await fixture.create({...input, ...change} as Parameters<typeof fixture.create>[0]);
    assert.ok("error" in result);
    assert.equal(fixture.writes.length, 0);
  }
});

test("old callers and explicit direct mode still require mailbox grant", async () => {
  for (const deliveryMode of [undefined, "oauth"] as const) {
    const fixture = approvalAction();
    const result = await fixture.create({...input, deliveryMode});
    assert.ok("error" in result && result.authUrl);
    assert.deepEqual(fixture.calls, ["access", "evidence", "provider"]);
    assert.equal(fixture.writes.length, 0);
  }
});
