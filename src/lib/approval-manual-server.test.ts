import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function manualActions(options: {accessError?: boolean; evidenceError?: boolean; rpcError?: boolean} = {}) {
  const calls: string[] = [];
  const rpcArgs: Record<string, unknown>[] = [];
  let requestRow: Record<string, unknown> | null = null;
  let delivery: Record<string, unknown> | null = null;
  const db = {from(table: string) {
    const filters: Record<string, unknown> = {};
    const query = {
      select() {return query;}, eq(key: string, value: unknown) {filters[key] = value; return query;}, order() {return query;}, limit() {return query;},
      async maybeSingle() {
        if (table === "projects") return {data: {name: "Checkout", google_sheet_url: "https://docs.google.com/test"}, error: null};
        if (table === "project_approval_requests") return {data: requestRow, error: null};
        if (table === "project_approval_manual_deliveries") return {data: delivery?.id === filters.id && delivery?.request_id === filters.request_id ? delivery : null, error: null};
        throw new Error(`Unexpected table ${table}`);
      },
    }; return query;
  }, rpc(name: string, args: Record<string, unknown>) {
    calls.push(`rpc:${name}`); rpcArgs.push(args);
    return {async single() {
      if (options.rpcError) return {data: null, error: {message: "รอบอีเมลมีการเปลี่ยนแปลง"}};
      if (name === "prepare_project_approval_manual_delivery") {
        requestRow = {...requestRow, ...args.p_request as object};
        delivery = {id: args.p_delivery_id, request_id: requestRow!.id, prepared_at: requestRow!.requested_at, draft: args.p_draft, confirmed_at: null, confirmed_by_name: ""};
        return {data: requestRow, error: null};
      }
      if (name === "confirm_project_approval_manual_delivery") {
        delivery = {...delivery, confirmed_at: "2026-10-30T04:00:00Z", confirmed_by_name: args.p_confirmed_by_name};
        return {data: delivery, error: null};
      }
      throw new Error(`Unexpected RPC ${name}`);
    }};
  }};
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const serverModule = {exports: {} as typeof import("../app/actions")};
  runInNewContext(compiled, {exports: serverModule.exports, module: serverModule, Error, process: {env: {NEXT_PUBLIC_SITE_URL: "https://qa.example.com"}}, require(id: string) {
    if (id === "@/lib/project-access-server") return {requireProjectCapability: async (_project: string, capability: string) => {
      calls.push(`access:${capability}`);
      if (options.accessError) throw new Error("No project access");
      return {userId: "00000000-0000-4000-8000-000000000001", claims: {email: "login@gmail.com", user_metadata: {name: "QA One"}}, project: {google_sheet_id: "sheet"}};
    }};
    if (id === "@/lib/approval-evidence-server") return {requireApprovalEvidenceReady: async () => {
      calls.push("evidence"); if (options.evidenceError) throw new Error("Missing evidence");
    }};
    if (id === "@/lib/supabase/admin") return {createAdminClient: () => {calls.push("database"); return db;}};
    if (id === "@/lib/qa-mail-server") return {getQaMailSender: async () => {calls.push("provider"); throw new Error("No connection");}, qaMailPreparationFailure: () => ({message: "Connect mailbox", reauthorize: true})};
    if (id === "@/lib/project-review") return {hashReviewToken: () => "a".repeat(64)};
    if (id === "next/cache") return {revalidatePath: () => {}};
    if (["@/lib/mail-provider", "@/lib/approval-email", "@/lib/approval-notification", "@/lib/approval-manual"].includes(id)) return localRequire(`./${id.slice("@/lib/".length)}`);
    if (id === "node:crypto") return localRequire(id);
    return {};
  }});
  return {actions: serverModule.exports, calls, rpcArgs};
}
const input = {deliveryMode: "manual" as const, projectId: "10000000-0000-4000-8000-000000000001", senderEmail: "qa@truecorp.co.th", recipientEmail: "po@example.com", cc: "lead@example.com", subject: "Review", body: "ผลทดสอบ", note: "", environment: "UAT", counts: {total: 1, pass: 1, failed: 0, skip: 0, notStart: 0, inProgress: 0}};

test("manual mode atomically persists a resumable full draft for Gmail and company senders without provider access", async () => {
  for (const senderEmail of ["qa@gmail.com", "qa@truecorp.co.th"]) {
    const {actions, calls, rpcArgs} = manualActions();
    const result = await actions.createProjectApprovalRequest({...input, senderEmail});
    assert.ok("request" in result, JSON.stringify(result));
    const delivery = result.request.manualDelivery;
    assert.ok(delivery);
    assert.equal(delivery.draft.senderEmail, "");
    assert.equal(delivery.draft.projectName, "Checkout");
    assert.equal(delivery.draft.subject, "Checkout");
    assert.equal(delivery.draft.recipientEmail, "po@example.com");
    assert.ok(delivery.draft.body.includes(`https://qa.example.com/approvals/${result.request.id}`));
    assert.equal(delivery.confirmedAt, "");
    assert.deepEqual(calls, ["access:edit", "evidence", "database", "rpc:prepare_project_approval_manual_delivery"]);
    assert.equal(rpcArgs[0].p_delivery_id, delivery.id);
    const resumed = await actions.getLatestProjectApproval(input.projectId);
    assert.ok("approval" in resumed && resumed.approval?.manualDelivery);
    assert.equal(resumed.approval.manualDelivery.id, delivery.id);
    assert.equal(resumed.approval.manualDelivery.draft.body, delivery.draft.body);
  }
});

test("manual send confirmation uses the signed-in actor and does not mark PO approved or provider delivered", async () => {
  const {actions, rpcArgs, calls} = manualActions();
  const prepared = await actions.createProjectApprovalRequest(input);
  assert.ok("request" in prepared && prepared.request.manualDelivery);
  const result = await actions.confirmManualApprovalSent({projectId: input.projectId, requestId: prepared.request.id, deliveryId: prepared.request.manualDelivery.id});
  assert.ok("request" in result, JSON.stringify(result));
  assert.equal(result.request.manualDelivery?.confirmedByName, "QA One");
  assert.equal(result.request.manualDelivery?.confirmedAt, "2026-10-30T04:00:00Z");
  assert.equal(result.request.status, "pending");
  assert.equal(result.request.emailSentAt, "");
  assert.equal(rpcArgs[1].p_confirmed_by, "00000000-0000-4000-8000-000000000001");
  assert.equal(rpcArgs[1].p_confirmed_by_name, "QA One");
  assert.equal(calls.includes("provider"), false);
});

test("project access and evidence remain mandatory; stale/persistence errors cannot report success", async () => {
  for (const options of [{accessError: true}, {evidenceError: true}, {rpcError: true}]) {
    const fixture = manualActions(options);
    const result = await fixture.actions.createProjectApprovalRequest(input);
    assert.ok("error" in result);
    assert.equal(fixture.calls.includes("provider"), false);
    if (options.accessError || options.evidenceError) assert.equal(fixture.rpcArgs.length, 0);
  }
  const fixture = manualActions({accessError: true});
  const result = await fixture.actions.confirmManualApprovalSent({projectId: input.projectId, requestId: "20000000-0000-4000-8000-000000000001", deliveryId: "30000000-0000-4000-8000-000000000001"});
  assert.ok("error" in result);
  assert.equal(fixture.rpcArgs.length, 0);
});


test("manual copying does not need a user-supplied sender email or provider grant", async () => {
  for (const senderEmail of [undefined, "", "invalid sender"]) {
    const {actions, calls} = manualActions();
    const result = await actions.createProjectApprovalRequest({...input, senderEmail});
    assert.ok("request" in result, JSON.stringify(result));
    assert.equal(result.request.manualDelivery?.draft.senderEmail, "");
    assert.equal(calls.includes("provider"), false);
  }
});
