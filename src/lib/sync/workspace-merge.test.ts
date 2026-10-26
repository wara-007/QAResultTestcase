import assert from "node:assert/strict";
import test from "node:test";
import type { TestCase } from "../types";
import { mergeWorkspaceAndGoogleCases, scopeGoogleDetailCases } from "./workspace-merge";

const makeCase = (id: string, name: string, persistedLocally = false): TestCase => ({
  id, name, persistedLocally, sourceRow: 2, platform: "", condition: "", scenario: "", steps: "", expected: "",
  status: "Not Start", device: "", testData: "", appVersion: "", environment: "", resultReference: "", executedBy: "",
  executedDate: "", executedTime: "", remark: "", evidence: [], results: [], defects: [],
});

test("opening a result tab keeps the saved register stable until an explicit import", () => {
  const saved = makeCase("TC-01", "Saved", true);
  const detail = makeCase("TC_01", "Latest detail");
  const addition = makeCase("TC-02", "New source entry");
  const snapshot = { ...makeCase("RC-other", "Unmapped tab"), sourceSheetName: "RC other" };
  assert.deepEqual(scopeGoogleDetailCases([saved], [detail, addition, snapshot]), [detail, snapshot]);
  assert.deepEqual(scopeGoogleDetailCases([], [detail, addition]), [detail, addition]);
  assert.equal(mergeWorkspaceAndGoogleCases([saved], [detail, addition], "QA").cases.length, 2);
});

test("keeps locally persisted testcase definition instead of hiding it with Google values", () => {
  const local = makeCase("TC-35", "Local dddd", true);
  local.scenario = "Local scenario";
  const google = makeCase("TC-35", "Google package");
  google.scenario = "Google scenario";
  const merged = mergeWorkspaceAndGoogleCases([local], [google], "Tester");
  assert.equal(merged.cases[0].name, "Local dddd");
  assert.equal(merged.cases[0].scenario, "Local scenario");
});

test("uses Google definition when no local edit was persisted", () => {
  const merged = mergeWorkspaceAndGoogleCases([makeCase("TC-01", "Stored")], [makeCase("TC-01", "Google")], "Tester");
  assert.equal(merged.cases[0].name, "Google");
});

test("refresh marks a legacy preview snapshot without discarding saved results", () => {
  const local = makeCase("Run A", "Stored", true);
  local.results = [{ id: "proof", status: "Pass", sourceSheetName: "Run A", actualResult: "QA edit", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  const google = { ...makeCase("Run A", "Run A"), sourceSheetName: "Run A", sourceRow: 0 };
  const refreshed = mergeWorkspaceAndGoogleCases([local], [google], "Tester").cases[0];
  assert.equal(refreshed.sourceSheetName, "Run A");
  assert.equal(refreshed.results?.[0].actualResult, "QA edit");
});

test("refreshes imported text while keeping its evidence and locally authored results", () => {
  const local = makeCase("TC-27", "Stored");
  const google = makeCase("TC-27", "Google");
  const imported = { id: "SHEET-IMPORT-RC TC-27", sourceSheetName: "RC TC-27", source: "sheets" as const, status: "Pass" as const, actualResult: "old", apiResponse: "", log: "old log", evidence: [], createdAt: "2026-01-01" };
  local.results = [{ ...imported, evidence: [{ fileId: "image", name: "proof", mimeType: "image/png" }] }, { ...imported, id: "WEB-1", source: "web", actualResult: "QA edit" }];
  google.results = [{ ...imported, log: "complete log", actualResult: "complete text" }];
  const result = mergeWorkspaceAndGoogleCases([local], [google], "Tester").cases[0].results!;
  assert.equal(result.length, 2);
  assert.equal(result.find(r => r.id === imported.id)?.log, "complete log");
  assert.equal(result.find(r => r.id === imported.id)?.evidence[0]?.fileId, "image");
  assert.equal(result.find(r => r.id === "WEB-1")?.actualResult, "QA edit");
});

test("refreshing imported cells preserves QA display settings", () => {
  const local = makeCase("TC-01", "Stored");
  const google = makeCase("TC-01", "Google");
  const result = { id: "SHEET-IMPORT-TC-01", sourceSheetName: "TC-01", status: "Pass" as const, actualResult: "old", apiResponse: "", log: "", evidence: [], createdAt: "" };
  local.results = [{ ...result, sheetDisplay: { modes: { first: "log" }, groupTransactions: false } }];
  google.results = [{ ...result, actualResult: "fresh", sheetDisplay: undefined }];
  const merged = mergeWorkspaceAndGoogleCases([local], [google], "Tester").cases[0].results![0];
  assert.equal(merged.actualResult, "fresh");
  assert.deepEqual(merged.sheetDisplay, { modes: { first: "log" }, groupTransactions: false });
});

test("refresh adds new imported evidence while preserving existing attachments without duplicates", () => {
  const local = makeCase("TC-01", "Stored");
  const google = makeCase("TC-01", "Google");
  const evidence = (fileId: string) => ({ fileId, name: `${fileId}.png`, mimeType: "image/png" });
  const result = { id: "SHEET-IMPORT-TC-01", sourceSheetName: "TC-01", source: "sheets" as const, status: "Pass" as const, actualResult: "", apiResponse: "", log: "", createdAt: "" };
  local.results = [{ ...result, evidence: [evidence("existing")] }];
  google.results = [{ ...result, evidence: [evidence("existing"), evidence("new")] }];
  const merged = mergeWorkspaceAndGoogleCases([local], [google], "Tester").cases[0].results![0];
  assert.deepEqual(merged.evidence.map(item => item.fileId), ["existing", "new"]);
  assert.deepEqual(local.results[0].evidence.map(item => item.fileId), ["existing"]);
});

test("explicit inline case ownership removes obsolete empty snapshots while preserving QA changes and saved proof", () => {
  const local = makeCase("FG01_TC01", "First", true);
  const imported = (id: string) => ({ id, source: "sheets" as const, sourceSheetName: "FG01", stepSheetMappingVersion: 1 as const, status: "Pass" as const, actualResult: "source text", apiResponse: "", log: "", evidence: [], createdAt: "" });
  local.results = [imported("SHEET-IMPORT-FG01-STEP-2"), imported("SHEET-IMPORT-FG01-STEP-5"),
    { ...imported("SHEET-IMPORT-FG01-STEP-6"), editedLocally: true },
    { ...imported("SHEET-IMPORT-FG01-STEP-7"), evidence: [{ fileId: "saved-proof", name: "proof.png", mimeType: "image/png", url: "https://example.com/proof.png" }] }];
  const fresh = { ...makeCase(local.id, local.name), results: [{ ...imported("SHEET-IMPORT-FG01-STEP-2"), stepSheetMappingVersion: 2 as const }] };
  const merged = mergeWorkspaceAndGoogleCases([local], [fresh], "").cases[0];
  assert.deepEqual(merged.results!.map(result => result.id), ["SHEET-IMPORT-FG01-STEP-2", "SHEET-IMPORT-FG01-STEP-6", "SHEET-IMPORT-FG01-STEP-7"]);
});

test("a resolved missing Ref warning clears on a case without Step definitions", () => {
  const local = makeCase("TC01", "First", true);
  local.importIssues = ['Ref (Result Testing): ไม่พบแท็บที่อ้างอิง "Proof A"', 'Other warning'];
  const fresh = { ...makeCase(local.id, local.name), importIssues: [] };
  assert.deepEqual(mergeWorkspaceAndGoogleCases([local], [fresh], "").cases[0].importIssues, ['Other warning']);
});
