import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { checkpointSheetImport } from "./sheet-import-state";

function serverReadiness(options: { missing?: boolean; sourceError?: boolean } = {}) {
  const source = { column_mapping: { sheets: [{ name: "Testcase" }, { name: "TC_501" }], sheetImport: {
    ...checkpointSheetImport(undefined, "sheet", { Testcase: "loaded", TC_501: "loaded" }, "2026-10-23T00:00:00Z", true),
    evidenceManifest: [{ testCaseId: "TC_501", sheetName: "TC_501", key: "sheet-TC_501-7-0" }],
  } } };
  const cases = Array.from({ length: 501 }, (_, index) => ({ id: `row-${index}`, testcase_key: `TC_${index + 1}` }));
  const reference = (withEvidence: boolean) => `qa-results:${JSON.stringify({ version: 1, results: [{ id: "result", sourceSheetName: "TC_501", evidence: withEvidence ? [{ name: "sheet-TC_501-7-0-image.png", fileId: "stored" }] : [] }] })}`;
  const executions = [
    ...cases.slice(0, 500).map(row => ({ test_case_id: row.id, result_reference: "" })),
    { test_case_id: "row-500", result_reference: reference(!options.missing) },
    { test_case_id: "row-500", result_reference: reference(true) }, // older attempt must not repair a missing latest attachment
  ];
  const ranges: string[] = [];
  const db = { from(table: string) {
    let start = 0; let end = 499;
    const builder = {
      select() { return builder; }, eq() { return builder; }, order() { return builder; }, limit() { return builder; }, maybeSingle() { return builder; },
      range(a: number, b: number) { start = a; end = b; ranges.push(`${table}:${a}`); return builder; },
      then(resolve: (response: unknown) => unknown) { return Promise.resolve(table === "source_files"
        ? { data: source, error: options.sourceError ? { message: "Source unavailable" } : null }
        : { data: (table === "test_cases" ? cases : executions).slice(start, end + 1), error: null }).then(resolve); },
    }; return builder;
  } };
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL("./approval-evidence-server.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const serverModule = { exports: {} as typeof import("./approval-evidence-server") };
  runInNewContext(compiled, { exports: serverModule.exports, module: serverModule, Error,
    require(id: string) { if (id === "server-only") return {}; if (id === "./supabase/admin") return { createAdminClient: () => db }; return localRequire(id); } });
  return { load: serverModule.exports.requireApprovalEvidenceReady, ranges };
}

test("approval checks saved evidence beyond page one using only the latest attempt", async () => {
  const loader = serverReadiness();
  assert.equal((await loader.load("project", "sheet")).ready, true);
  assert.ok(loader.ranges.includes("test_cases:500"));
  await assert.rejects(serverReadiness().load("project", "different-sheet"), /ยังนำเข้า/);
  assert.ok(loader.ranges.includes("test_executions:500"));
  await assert.rejects(serverReadiness({ missing: true }).load("project", "sheet"), /รูปหลักฐานยังบันทึกไม่ครบ/);
  await assert.rejects(serverReadiness({ sourceError: true }).load("project", "sheet"), /Source unavailable/);
});

test("evidence gate runs before mailbox access or approval reservation", () => {
  const actions = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
  const action = actions.slice(actions.indexOf("export async function createProjectApprovalRequest"), actions.indexOf("type CreateProjectInput"));
  assert.ok(action.indexOf("await requireApprovalEvidenceReady(input.projectId, access.googleSheetId)") > action.indexOf('getSignedInProject(input.projectId, "edit")'));
  assert.ok(action.indexOf("await requireApprovalEvidenceReady(input.projectId, access.googleSheetId)") < action.indexOf("getQaMailSender(access.email)"));
});
