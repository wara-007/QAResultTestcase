import type { TestCase, TestEvidence, TestStatus } from "./types";
import { parseStepTestCases } from "./step-testcases";
const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[\n\r*._()/-]+/g, " ").replace(/\s+/g, " ").trim();
const statusFromValue = (value: unknown): TestStatus => {
  const status = normalize(value);
  if (status === "pass" || status === "passed") return "Pass";
  if (status === "fail" || status === "failed") return "Failed";
  if (status === "skip" || status === "skipped") return "Skip";
  if (status === "in progress") return "In Progress";
  return "Not Start";
};
const evidenceFromValue = (value: unknown): TestEvidence[] => {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TestEvidence => Boolean(
      item && typeof item.fileId === "string" && typeof item.name === "string" && typeof item.mimeType === "string",
    ));
  } catch {
    return [];
  }
};

export function casesFromRows(rows: unknown[][]): TestCase[] {
  const stepCases = parseStepTestCases(rows, "Testcase");
  if (stepCases) return stepCases;
  const aliases: Record<string, string[]> = {
    id: ["testcase id", "test case id", "case id"], platform: ["platform"], condition: ["condition"], scenario: ["test scenario", "scenario"],
    name: ["test case name", "testcase name", "case name"], steps: ["test step description", "test step", "steps"], expected: ["expected result", "expected"],
    status: ["test result", "status", "result"], device: ["device"], testData: ["data test", "test data"], appVersion: ["app version", "version"],
    environment: ["env", "environment"], resultReference: ["ref result testing", "result testing", "result reference"], executedBy: ["executed by", "tester"],
    executedDate: ["executed date", "test date"], executedTime: ["executed time", "test time"], remark: ["remark", "note", "notes"],
    evidence: ["evidence", "evidence images", "attachments"],
  };
  const isHeader = (row: unknown[]) => row.some(cell => aliases.id.includes(normalize(cell)));
  let headerIndex = rows.findIndex(isHeader);
  if (headerIndex < 0) headerIndex = 0;
  let baseHeader = rows[headerIndex] ?? [];
  let header = [...baseHeader];
  const detectIndexes = () => Object.fromEntries(Object.entries(aliases).map(([field, names]) => {
    const exact = header.findIndex(cell => names.includes(normalize(cell)));
    return [field, exact >= 0 ? exact : header.findIndex(cell => names.some(name => normalize(cell).includes(name)))];
  }));
  let indexes = detectIndexes();
  const get = (row: unknown[], field: string) => indexes[field] >= 0 ? String(row[indexes[field]] ?? "").trim() : "";
  let previousScenario = "";
  let previousSteps = "";
  let section = "";
  let sectionRow = 0;
  return rows.slice(headerIndex + 1).flatMap((row, offset) => {
    const sourceRow = headerIndex + offset + 2;
    if (isHeader(row)) {
      baseHeader = [...row];
      header = [...row];
      indexes = detectIndexes();
      previousScenario = previousSteps = "";
      return [];
    }
    const id = get(row, "id");
    if (!id) return [];
    // IDs come from the declared ID column, not a hard-coded TC prefix.
    // Section titles contain prose; identifiers are numeric or compact keys.
    const populatedCount = row.filter(cell => String(cell ?? "").trim()).length;
    const identifier = /^(?:[\p{L}\p{N}][\p{L}\p{N}_.:-]*|(?:TC|TEST|CASE)[\s_-]*\d[\w\s-]*)$/iu.test(id)
      && (populatedCount > 1 || /\d/.test(id));
    if (!identifier) {
      section = id;
      sectionRow = sourceRow;
      previousScenario = previousSteps = "";
      header = [...baseHeader];
      row.forEach((cell, column) => {
        if (column !== indexes.id && String(cell ?? "").trim()) header[column] = cell;
      });
      indexes = detectIndexes();
      return [];
    }
    const standardColumns = new Set(Object.values(indexes).filter(index => index >= 0));
    const customHeaders = Array.from({ length: Math.max(header.length, row.length) }, (_, column) => ({
      label: String(header[column] ?? "").trim() || `คอลัมน์ ${column + 1}`,
      column,
    })).filter(({ column }) => !standardColumns.has(column) && (String(header[column] ?? "").trim() || String(row[column] ?? "").trim()));
    const scenario = get(row, "scenario") || previousScenario;
    const steps = get(row, "steps") || previousSteps;
    if (scenario) previousScenario = scenario;
    if (steps) previousSteps = steps;
    return [{
      id, sourceRow, platform: get(row, "platform"), condition: get(row, "condition"), scenario,
      name: get(row, "name"), steps, expected: get(row, "expected"), status: statusFromValue(get(row, "status")), device: get(row, "device"),
      testData: get(row, "testData"), appVersion: get(row, "appVersion"), environment: get(row, "environment"), resultReference: get(row, "resultReference"),
      executedBy: get(row, "executedBy"), executedDate: get(row, "executedDate"), executedTime: get(row, "executedTime"), remark: get(row, "remark"),
      evidence: evidenceFromValue(get(row, "evidence")),
      customFields: [...(section ? [{ key: "testcase:source-section", label: "Section", value: section, source: "testcase" as const, sheetName: "Testcase", row: sectionRow, column: -1 }] : []), ...customHeaders.map(({ label, column }) => ({
        key: `testcase:${normalize(label)}:${column}`,
        label,
        value: String(row[column] ?? "").trim(),
        source: "testcase" as const,
        sheetName: "Testcase",
        row: sourceRow,
        column,
      }))],
    }];
  });
}

export function testCaseSourceSection(testCase: Pick<TestCase, "customFields">) {
  return testCase.customFields?.find(field => field.key === "testcase:source-section")?.value ?? "";
}
