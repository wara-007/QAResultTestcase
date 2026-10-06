import type { TestCase, TestCaseStep, TestStatus } from "./types";

export const stepHeaderKey = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export const stepColumnName = (column: number) => {
  let value = column + 1, name = "";
  while (value > 0) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26); }
  return name;
};
export function stepHeaderColumns(row: unknown[]) {
  const find = (...keys: string[]) => row.findIndex(cell => keys.includes(stepHeaderKey(cell)));
  const columns = { id: find("testcasetcid"), scenario: find("testscenario"), scenarioDescription: find("testscenariodescriptionhighleveltestcase"), name: find("testcasename"), classification: find("positivenegativecase"), step: find("step"), description: find("descriptionstep"), expected: find("expectedresultfn", "expectedresult"), status: find("status"), device: find("device"), environment: find("env", "environment"), appVersion: find("appv", "appversion"), resultReference: find("refresulttesting"), executedBy: find("executedby"), executedDate: find("executeddate"), remark: find("remark") };
  return columns.id >= 0 && columns.step >= 0 && columns.description >= 0 && columns.expected >= 0 ? columns : null;
}
export function stepStatus(value: unknown): TestCaseStep["status"] {
  const key = stepHeaderKey(value);
  if (!key || key === "notstart" || key === "notstarted") return "Not Start";
  if (["pass", "passed"].includes(key)) return "Pass";
  if (["fail", "failed"].includes(key)) return "Failed";
  if (["testing", "inprogress"].includes(key)) return "In Progress";
  if (["skip", "skipped"].includes(key)) return "Skip";
  if (["block", "blocked"].includes(key)) return "Blocked";
  return "Unknown";
}
export function aggregateStepStatus(steps: TestCaseStep[]): TestStatus {
  if (steps.some(s => s.status === "Failed")) return "Failed";
  if (steps.some(s => ["In Progress", "Blocked", "Unknown"].includes(s.status))) return "In Progress";
  if (!steps.length || steps.every(s => s.status === "Not Start")) return "Not Start";
  if (steps.every(s => s.status === "Skip")) return "Skip";
  if (steps.every(s => s.status === "Pass" || s.status === "Skip")) return "Pass";
  return "In Progress";
}

export function parseStepTestCases(rows: unknown[][], sheetName: string): TestCase[] | null {
  const headerIndex = rows.findIndex(row => stepHeaderColumns(row));
  if (headerIndex < 0) return null;
  let columns = stepHeaderColumns(rows[headerIndex])!;
  let headers = rows[headerIndex];
  const cases: TestCase[] = [];
  let current: TestCase | undefined;
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    const nextColumns = stepHeaderColumns(row);
    if (nextColumns) { columns = nextColumns; headers = row; current = undefined; continue; }
    const get = (field: keyof typeof columns) => columns[field] >= 0 ? String(row[columns[field]] ?? "").trim() : "";
    if (!row.some(cell => String(cell ?? "").trim())) { current = undefined; continue; }
    const id = get("id");
    if (id) {
      current = { id, sourceRow: index + 1, platform: "", condition: get("classification"), scenario: [get("scenario"), get("scenarioDescription")].filter(Boolean).join("\n"), name: get("name"), steps: "", expected: "", status: "Not Start", device: get("device"), testData: "", appVersion: get("appVersion"), environment: get("environment"), resultReference: get("resultReference"), executedBy: get("executedBy"), executedDate: get("executedDate"), executedTime: "", remark: get("remark"), evidence: [], stepDefinitions: [], importIssues: [] };
      cases.push(current);
    }
    if (!get("step") && !get("description") && !get("expected")) { current = undefined; continue; }
    if (!current) continue;
    const step: TestCaseStep = { id: `${sheetName}:${index + 1}`, sourceSheetName: sheetName, sourceRow: index + 1, name: get("step"), description: get("description"), expected: get("expected"), classification: get("classification"), rawStatus: get("status"), status: stepStatus(get("status")), device: get("device"), environment: get("environment"), appVersion: get("appVersion"), executedBy: get("executedBy"), executedDate: get("executedDate"), resultReference: get("resultReference"), remark: get("remark") };
    current.stepDefinitions!.push(step);
    const mappedColumns = new Set(Object.values(columns).filter(column => column >= 0));
    step.sourceFields = Array.from({ length: Math.max(headers.length, row.length) }, (_, column) => ({
      ref: `${stepColumnName(column)}${index + 1}`, column,
      label: String(headers[column] ?? "").trim() || `คอลัมน์ ${stepColumnName(column)}`,
      value: String(row[column] ?? ""), mapped: mappedColumns.has(column),
    }));
    if (step.status === "Unknown") current.importIssues!.push(`${step.name}: สถานะไม่รู้จัก (${step.rawStatus})`);
  }
  for (const testCase of cases) {
    testCase.steps = testCase.stepDefinitions!.map(s => `${s.name}\n${s.description}`).join("\n\n");
    testCase.expected = testCase.stepDefinitions!.map(s => `${s.name}\n${s.expected}`).join("\n\n");
    testCase.status = aggregateStepStatus(testCase.stepDefinitions!);
  }
  return cases;
}
