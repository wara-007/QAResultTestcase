import { createHash } from "node:crypto";
import type { TestCase } from "../types";
import type { CanonicalProjectSnapshot, CanonicalTestCase } from "./types";

export function canonicalCaseId(value: string) {
  const match = value.trim().match(/^(?:TC|TEST\s*CASE|TESTCASE|CASE)[\s:_-]*(\d+)$/i);
  return match ? `TC-${Number(match[1])}` : value.trim().toUpperCase();
}

export function canonicalChildId(sourceSheetName: string | undefined, id: string) {
  return `${(sourceSheetName ?? "web").trim().toLowerCase()}:${id.trim().toLowerCase()}`;
}

const label = (value: string) => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sortedEntries = <T>(entries: Array<[string, T]>) => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) as Record<string, T>;

function canonicalizeCase(testCase: TestCase): CanonicalTestCase {
  return {
    id: canonicalCaseId(testCase.id), platform: testCase.platform, condition: testCase.condition, scenario: testCase.scenario,
    name: testCase.name, steps: testCase.steps, expected: testCase.expected, status: testCase.status, device: testCase.device,
    testData: testCase.testData, appVersion: testCase.appVersion, environment: testCase.environment, executedBy: testCase.executedBy,
    executedDate: testCase.executedDate, executedTime: testCase.executedTime, remark: testCase.remark,
    customFields: sortedEntries((testCase.customFields ?? []).map((field) => [`${field.source}:${field.sheetName.toLowerCase()}:${label(field.label)}`, field.value])),
    results: sortedEntries((testCase.results ?? []).map((result) => [canonicalChildId(result.sourceSheetName, result.id), {
      id: result.id, status: result.status, actualResult: result.actualResult, apiResponse: result.apiResponse, log: result.log,
      createdAt: result.createdAt, customFields: sortedEntries((result.customFields ?? []).map((field) => [label(field.label), field.value])),
    }])),
    defects: sortedEntries((testCase.defects ?? []).map((defect) => [canonicalChildId(defect.sourceSheetName, defect.id), {
      id: defect.id, title: defect.title, description: defect.description, status: defect.status, jiraUrl: defect.jiraUrl,
      apiResponse: defect.apiResponse, log: defect.log, createdAt: defect.createdAt,
    }])),
  };
}

export function canonicalizeCases(cases: TestCase[]): CanonicalProjectSnapshot {
  return { cases: sortedEntries(cases.map((testCase) => [canonicalCaseId(testCase.id), canonicalizeCase(testCase)])) };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}

export function hashSnapshot(snapshot: CanonicalProjectSnapshot) {
  return createHash("sha256").update(JSON.stringify(stable(snapshot))).digest("hex");
}
