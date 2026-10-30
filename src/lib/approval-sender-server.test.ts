import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function approvalActions(options: { evidenceError?: boolean; grantError?: boolean } = {}) {
  const calls: string[] = [];
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const serverModule = { exports: {} as typeof import("../app/actions") };
  runInNewContext(compiled, { exports: serverModule.exports, module: serverModule, Error, process: {env: {}},
    require(id: string) {
      if (id === "@/lib/project-access-server") return {requireProjectCapability: async () => {
        calls.push("access");
        return {userId: "qa-user", claims: {email: "qa@gmail.com"}, project: {google_sheet_id: "sheet"}};
      }};
      if (id === "@/lib/approval-evidence-server") return {requireApprovalEvidenceReady: async () => {
        calls.push("evidence");
        if (options.evidenceError) throw new Error("Evidence missing");
      }};
      if (id === "@/lib/qa-mail-server") return {
        getQaMailConnection: async (email: string) => ({email, connected: false, configured: true}),
        getQaMailSender: async (email: string) => {
          calls.push(`grant:${email}`);
          if (options.grantError) throw new Error("Grant required");
          return {provider: "gmail", send: async () => {calls.push("send");}};
        },
        qaMailPreparationFailure: () => ({message: "Connect selected mailbox", reauthorize: true}),
      };
      if (id === "@/lib/supabase/admin") return {createAdminClient: () => {
        calls.push("database");
        throw new Error("Stop before database write");
      }};
      if (id === "@/lib/mail-provider") return localRequire("./mail-provider");
      return {};
    },
  });
  return {actions: serverModule.exports, calls};
}
const input = {projectId: "project", senderEmail: " Other@Gmail.com ", recipientEmail: "po@example.com", cc: "", subject: "Review", body: "Results", note: "", environment: "UAT", counts: {total: 1, pass: 1, failed: 0, skip: 0, notStart: 0, inProgress: 0}};

test("approval checks project access and evidence before verifying selected sender grant", async () => {
  const {actions, calls} = approvalActions();
  await actions.createProjectApprovalRequest(input);
  assert.deepEqual(calls, ["access", "evidence", "grant:other@gmail.com", "database"]);
  const blocked = approvalActions({evidenceError: true});
  const result = await blocked.actions.createProjectApprovalRequest(input);
  assert.ok("error" in result);
  assert.equal(result.error, "Evidence missing");
  assert.deepEqual(blocked.calls, ["access", "evidence"]);
});

test("unconnected sender cannot reserve or send approval and reauthorization keeps selected mailbox", async () => {
  const {actions, calls} = approvalActions({grantError: true});
  const result = await actions.createProjectApprovalRequest(input);
  assert.ok("error" in result && result.authUrl);
  assert.equal(new URL(result.authUrl, "https://app.test").searchParams.get("senderEmail"), "other@gmail.com");
  assert.deepEqual(calls, ["access", "evidence", "grant:other@gmail.com"]);
});

test("connection status uses selected sender while old clients default to login email", async () => {
  const {actions} = approvalActions();
  const selected = await actions.getApprovalMailConnection("project", "other@truecorp.co.th");
  assert.ok("email" in selected);
  assert.equal(selected.email, "other@truecorp.co.th");
  const fallback = await actions.getApprovalMailConnection("project");
  assert.ok("email" in fallback);
  assert.equal(fallback.email, "qa@gmail.com");
  assert.ok("error" in await actions.getApprovalMailConnection("project", "invalid"));
});
