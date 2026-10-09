import assert from "node:assert/strict";
import test from "node:test";
import type { TestCase } from "../types";
import { mergeWorkspaceAndGoogleCases } from "./workspace-merge";

const makeCase = (id: string, name: string, persistedLocally = false): TestCase => ({
  id, name, persistedLocally, sourceRow: 2, platform: "", condition: "", scenario: "", steps: "", expected: "",
  status: "Not Start", device: "", testData: "", appVersion: "", environment: "", resultReference: "", executedBy: "",
  executedDate: "", executedTime: "", remark: "", evidence: [], results: [], defects: [],
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
