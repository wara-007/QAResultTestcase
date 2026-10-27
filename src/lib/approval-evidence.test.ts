import assert from "node:assert/strict";
import test from "node:test";
import { approvalEvidenceReadiness, importedEvidenceKey } from "./approval-evidence";
import { checkpointSheetImport, readSheetImportState } from "./sheet-import-state";
import { runSheetEvidenceImports } from "./sheet-import-progress";

const target = { testCaseId: "TC_01", sheetName: "TC_01", key: "sheet-TC_01-7-0" };
const saved = [{ id: "TC_01", results: [{ sourceSheetName: "TC_01", evidence: [{ name: "123-sheet-TC_01-7-0-image.png", fileId: "stored-image" }] }] }];
const complete = () => ({ ...checkpointSheetImport(undefined, "sheet", { Testcase: "loaded", TC_01: "loaded" }, "2026-10-23T00:00:00Z", true), evidenceManifest: [target] });

test("approval blocks partial imports even when a viewed case already has its image", () => {
  assert.equal(approvalEvidenceReadiness({ ...complete(), complete: false }, saved, ["Testcase", "TC_01"]).ready, false);
  assert.equal(approvalEvidenceReadiness(complete(), saved, ["Testcase", "TC_01", "TC_02"]).ready, false);
  assert.equal(approvalEvidenceReadiness({ ...complete(), refreshRequired: true }, saved).ready, false);
});
test("approval requires persisted evidence for each case and source anchor", () => {
  assert.equal(approvalEvidenceReadiness(complete(), saved).ready, true);
  assert.equal(approvalEvidenceReadiness(complete(), []).ready, false);
  assert.equal(approvalEvidenceReadiness(complete(), [{ ...saved[0], id: "TC_02" }]).ready, false);
  assert.equal(approvalEvidenceReadiness(complete(), [{ id: "TC_01", results: [{ sourceSheetName: "TC_01", evidence: [{ name: target.key, fileId: "" }] }] }]).ready, false);
  assert.equal(approvalEvidenceReadiness(complete(), [{ id: "TC_01", results: [{ sourceSheetName: "TC_01", evidence: [{ name: `${target.key}1-image.png`, fileId: "other" }] }] }]).ready, false);
});
test('an image missing from a loaded tab is identified explicitly even when the snapshot is incomplete', () => {
  const missing={testCaseId:'SUN-8073_01',sheetName:'SUN-8073_01',key:'sheet-proof-missing'};
  const state={...complete(),complete:false,states:{Testcase:'loaded' as const,TC_01:'loaded' as const,'SUN-8073_01':'loaded' as const},evidenceManifest:[target,missing]};
  const readiness=approvalEvidenceReadiness(state,saved);
  assert.deepEqual(readiness.missing,[missing]);
  assert.match(readiness.reason,/รูปหลักฐานยังบันทึกไม่ครบ 1\/2/);
});
test("legacy metadata and empty image counts are not proof of an evidence import", () => {
  const legacy = complete();
  delete (legacy as Partial<typeof legacy>).evidenceManifest;
  assert.equal(approvalEvidenceReadiness(legacy, []).ready, false);
  assert.equal(approvalEvidenceReadiness(undefined, []).ready, false);
  assert.equal(approvalEvidenceReadiness({ ...complete(), evidenceManifest: [] }, []).ready, true);
});
test("evidence manifest survives checkpoints and serialization, but malformed entries are rejected", async () => {
  assert.deepEqual(readSheetImportState(checkpointSheetImport(complete(), "sheet", {}, "2026-10-23T01:00:00Z", true))?.evidenceManifest, [target]);
  assert.equal(readSheetImportState({ ...complete(), evidenceManifest: [{ key: 123 }] }), undefined);
  const first = await importedEvidenceKey({ sheetName: "TC_01", row: 7, column: 0, bytes: new Uint8Array([1]) });
  const second = await importedEvidenceKey({ sheetName: "TC_01", row: 7, column: 0, bytes: new Uint8Array([2]) });
  assert.notEqual(first, second);
  assert.match(first, /^sheet-proof-[a-f0-9]{64}$/);
  const longName = await importedEvidenceKey({ sheetName: "Very long tab name ".repeat(20), row: 100000, column: 1000, bytes: new Uint8Array([1]) });
  assert.equal(longName.length, 76);
  assert.notEqual(first, longName);
  assert.equal(approvalEvidenceReadiness({ ...complete(), evidenceManifest: [target, target] }, saved).ready, false);
});

for (const failSecondImage of [false, true]) test(`whole-project evidence import covers unopened cases; upload failure=${failSecondImage}`, async () => {
  const tabs = ["TC_01", "TC_02"];
  const images = tabs.map((sheetName, index) => ({ sheetName, row: 7, column: index, bytes: new Uint8Array([index]) }));
  const manifest = await Promise.all(images.map(async image => ({ testCaseId: image.sheetName, sheetName: image.sheetName, key: await importedEvidenceKey(image) })));
  const cases = tabs.map(id => ({ id, results: [{ sourceSheetName: id, evidence: [] as { name: string; fileId: string }[] }] }));
  let storedCases = JSON.parse(JSON.stringify(cases)) as typeof cases;
  const states: Record<string, "loaded" | "error" | "queued" | "loading"> = { TC_01: "queued", TC_02: "queued" };
  await runSheetEvidenceImports(tabs, images, image => image.sheetName, async image => {
    if (failSecondImage && image.sheetName === "TC_02") return false;
    cases.find(item => item.id === image.sheetName)!.results[0].evidence.push({ name: `${await importedEvidenceKey(image)}-proof.png`, fileId: `uploaded-${image.sheetName}` });
    return true;
  }, async () => { storedCases = JSON.parse(JSON.stringify(cases)); }, () => {}, (name, state) => { states[name] = state; });
  const snapshot = { ...complete(), states, evidenceManifest: manifest };
  assert.equal(approvalEvidenceReadiness(snapshot, storedCases, tabs).ready, !failSecondImage);
  assert.equal(approvalEvidenceReadiness(snapshot, storedCases, tabs).persisted, failSecondImage ? 1 : 2);
});

test('a fully saved interrupted import can finalize without rewriting results only at the same revision', async () => {
 const { canFinalizeSavedImport } = await import('./approval-evidence');
 const state = {...complete(),complete:false,sourceRevision:'revision-1'};
 assert.equal(canFinalizeSavedImport(state,saved,['TC_01'],'revision-1'),true);
 assert.equal(canFinalizeSavedImport(state,saved,['TC_01'],'revision-2'),false);
 assert.equal(canFinalizeSavedImport({...state,refreshRequired:true},saved,['TC_01'],'revision-1'),false);
 assert.equal(canFinalizeSavedImport(state,[],['TC_01'],'revision-1'),false);
 assert.equal(canFinalizeSavedImport({...state,states:{TC_01:'queued'}},saved,['TC_01'],'revision-1'),false);
 assert.equal(canFinalizeSavedImport({...state,evidenceManifest:undefined},saved,['TC_01'],'revision-1'),false);
});
