import { caseResultReferences, safeResultSheetName } from "./sheet-mapping-model";
import { displayTestCaseId } from "./register-case-identity";
import { TEST_STATUSES, type TestCase, type TestResult } from "./types";
import { parseStepTestCases, stepHeaderColumns } from "./step-testcases";

const columnName = (column: number) => {
  let index = column + 1, name = "";
  while (index) { index--; name = String.fromCharCode(65 + index % 26) + name; index = Math.floor(index / 26); }
  return name;
};
export const STEP_SNAPSHOT_START = "QA Workspace Results v1";
const STEP_SNAPSHOT_END = "QA Workspace Results end";

export function buildStepSheetWritePlan(cases: TestCase[], rows: unknown[][]): { range: string; values: unknown[][] }[] {
  const sourceCases = parseStepTestCases(rows, "Testcase");
  if (!sourceCases) throw new Error("รูปแบบตาราง Step เปลี่ยน กรุณาโหลดจาก Sheets ใหม่ก่อนซิงค์");
  const writes: { range: string; values: unknown[][] }[] = [];
  const usedRows = new Set<number>();
  for (const testCase of cases.filter(item => item.stepDefinitions?.length)) {
    const owner = sourceCases.find(item => item.id === displayTestCaseId(testCase) && item.stepDefinitions?.some(step => testCase.stepDefinitions?.some(candidate => candidate.sourceRow === step.sourceRow)));
    if (!owner) throw new Error(`Test Case ${testCase.id} เปลี่ยนหรือยังไม่มีใน Sheets กรุณาโหลดจาก Sheets ใหม่`);
    for (const step of testCase.stepDefinitions ?? []) {
      if (step.sourceSheetName !== "Testcase") throw new Error("ตำแหน่ง Step เปลี่ยน: ซิงค์ได้เฉพาะตาราง Testcase ไม่ใช่ Cover");
      if (usedRows.has(step.sourceRow) || !owner.stepDefinitions?.some(item => item.sourceRow === step.sourceRow && item.name === step.name && item.description === step.description && item.expected === step.expected && item.classification === step.classification)) throw new Error(`ตำแหน่งหรือรายละเอียด Step ${step.name} เปลี่ยน กรุณาโหลดจาก Sheets ใหม่`);
      usedRows.add(step.sourceRow);
      const header = rows.slice(0, step.sourceRow).reverse().find(row => stepHeaderColumns(row));
      const columns = header ? stepHeaderColumns(header)! : null;
      if (!columns) throw new Error("หัวตาราง Step เปลี่ยน");
      for (const field of ["status", "device", "environment", "appVersion", "resultReference", "executedBy", "executedDate", "remark"] as const) {
        const column = columns[field];
        if (column < 0 || String(rows[step.sourceRow - 1]?.[column] ?? "").startsWith("=")) continue;
        const value = field === "status" ? (({ "In Progress": "TESTING", "Blocked": "Block", "Not Start": "NotStart", "Unknown": step.rawStatus } as Record<string, string>)[step.status] ?? step.status) : step[field];
        writes.push({ range: `'${step.sourceSheetName.replaceAll("'", "''")}'!${columnName(column)}${step.sourceRow}`, values: [[value]] });
      }
    }
  }
  return writes;
}

const snapshotReference = (item: TestCase) => {
  const references = [...new Set(caseResultReferences(item))].sort();
  return references.length ? JSON.stringify(references) : undefined;
};

export type SnapshotOwnership = { reference?: string; uniqueReference: boolean; uniqueDefinition: boolean; otherDefinitions: string[]; singleTabOwner: boolean; ambiguousDefinition: boolean };
export function snapshotOwnership(item: TestCase, cases: readonly TestCase[], sheetName: string): SnapshotOwnership {
  const peers = cases.filter(row => displayTestCaseId(row) === displayTestCaseId(item));
  const reference = snapshotReference(item);
  const tabOwners = peers.filter(row => {
    const refs = caseResultReferences(row);
    return refs.length ? refs.includes(sheetName) : safeResultSheetName(row.id) === sheetName;
  });
  return { reference, uniqueReference: !!reference && peers.filter(row => snapshotReference(row) === reference).length === 1,
    uniqueDefinition: !!item.registerIdentity && peers.filter(row => row.registerIdentity?.fingerprint === item.registerIdentity?.fingerprint).length === 1,
    otherDefinitions: peers.filter(row => row.registerIdentity?.fingerprint !== item.registerIdentity?.fingerprint).flatMap(row => row.registerIdentity ? [row.registerIdentity.fingerprint] : []),
    singleTabOwner: tabOwners.length === 1 && tabOwners[0].id === item.id,
    ambiguousDefinition: peers.some(row => row.id !== item.id && row.registerIdentity?.fingerprint === item.registerIdentity?.fingerprint && snapshotReference(row) !== reference) };
}

export function stepResultSnapshotRows(testCase: TestCase): string[][] {
  const rows: string[][] = [[STEP_SNAPSHOT_START, testCase.id, testCase.registerIdentity ? JSON.stringify(testCase.registerIdentity) : "", snapshotReference(testCase) ?? ""]];
  const append = (label: string, text: string) => {
    if (!text) { rows.push([label, ""]); return; }
    for (let start = 0; start < text.length; start += 49000) rows.push([label, text.slice(start, start + 49000)]);
  };
  for (const result of testCase.results ?? []) {
    if (result.source === "sheets" && !result.editedLocally) continue;
    rows.push(["QA Result", result.id, result.stepId ?? "", result.status, result.createdAt, result.testerName ?? "", result.sourceSheetName ?? "", result.source ?? "web"]);
    append("Actual result", result.actualResult);
    append("API response", result.apiResponse);
    append("Log", result.log);
    append("Evidence", JSON.stringify(result.evidence));
    append("QA metadata", JSON.stringify({ sheetSections: result.sheetSections, textHighlights: result.textHighlights, customFields: result.customFields }));
  }
  if (testCase.defects?.length || testCase.customFields?.some(field => field.source === "detail") || testCase.resultFieldDefinitions?.length) append("QA case metadata", JSON.stringify({ defects: testCase.defects ?? [], customFields: (testCase.customFields ?? []).filter(field => field.source === "detail"), resultFieldDefinitions: testCase.resultFieldDefinitions }));
  rows.push([STEP_SNAPSHOT_END, testCase.id]);
  if (rows.flat().some(value => value.length >= 50000)) throw new Error("ข้อมูลหัวข้อ Result ยาวเกินขนาดเซลล์ที่ Sheets รองรับ");
  return rows;
}

export function readStepCaseSnapshot(rows: unknown[][], caseId: string, identity?: TestCase["registerIdentity"], allowLegacy = true, allowChangedDefinition = false, ownership?: SnapshotOwnership): { results: TestResult[]; defects?: TestCase["defects"]; customFields?: TestCase["customFields"]; resultFieldDefinitions?: TestCase["resultFieldDefinitions"] } {
  // A tab that currently has one owner may contain snapshots from several
  // historic owners. Only one compatible legacy owner makes tab scoping proof.
  const legacyOwners = new Set<string>();
  if (identity && ownership?.singleTabOwner) {
    for (const row of rows) {
      if (row[0] !== STEP_SNAPSHOT_START || row[3] || !row[2]) continue;
      try {
        const stored = JSON.parse(String(row[2]));
        if (stored.sourceId === identity.sourceId && (stored.fingerprint === identity.fingerprint || (allowChangedDefinition && String(row[1]) === caseId))) {
          legacyOwners.add(JSON.stringify([row[1], stored.sourceId, stored.fingerprint, stored.occurrence]));
        }
      } catch { /* Malformed markers never establish ownership. */ }
    }
  }
  let caseData: { defects?: TestCase["defects"]; customFields?: TestCase["customFields"]; resultFieldDefinitions?: TestCase["resultFieldDefinitions"] } = {};
  let caseMetadata = "";
  let active = false;
  let result: TestResult | undefined;
  let results: TestResult[] = [], pending: TestResult[] = [];
  let evidence = "", metadata = "";
  const finish = () => {
    if (!result) return;
    try { const parsed = JSON.parse(evidence); if (Array.isArray(parsed)) result.evidence = parsed; } catch { /* Keep the Result even when evidence metadata is damaged. */ }
    try { const parsed = JSON.parse(metadata); if (parsed && typeof parsed === "object") { result.sheetSections = parsed.sheetSections; result.textHighlights = parsed.textHighlights; result.customFields = parsed.customFields; } } catch { /* Keep text independently of metadata. */ }
    pending.push(result); result = undefined; evidence = metadata = "";
  };
  for (const row of rows) {
    const value = (column: number) => String(row[column] ?? "");
    if (value(0) === STEP_SNAPSHOT_START) { active = allowLegacy && value(1) === caseId;
      if (value(2) && identity) {
        try {
          const stored = JSON.parse(value(2));
          const sameDefinition = stored.sourceId === identity.sourceId && stored.fingerprint === identity.fingerprint;
          // A known distinct definition owns its snapshot even after Ref edits.
          if (ownership?.uniqueDefinition && sameDefinition) active = true;
          else if (ownership?.otherDefinitions.includes(stored.fingerprint)) active = false;
          else if (value(3) && ownership?.reference && ownership.uniqueReference) active = stored.sourceId === identity.sourceId && value(3) === ownership.reference;
          // Older snapshots have no reference discriminator. The tab itself may
          // identify one duplicate owner; shared ambiguous tabs cannot.
          else if (!value(3) && ownership?.singleTabOwner) active = legacyOwners.size === 1 && (sameDefinition || (allowChangedDefinition && stored.sourceId === identity.sourceId && value(1) === caseId));
          else active = !ownership?.ambiguousDefinition && ((sameDefinition && stored.occurrence === identity.occurrence) || (allowChangedDefinition && value(1) === caseId));
        } catch { active = false; }
      } pending = []; result = undefined; evidence = metadata = caseMetadata = ""; continue; }
    if (!active) continue;
    if (value(0) === STEP_SNAPSHOT_END) { finish(); results = pending; caseData = {}; try { const parsed = JSON.parse(caseMetadata); if (parsed && typeof parsed === "object") caseData = parsed; } catch { /* Legacy snapshots have no case payload. */ } active = false; continue; }
    if (value(0) === "QA case metadata") { caseMetadata += value(1); continue; }
    if (value(0) === "QA Result") {
      finish();
      result = { id: value(1), stepId: value(2) || undefined, status: TEST_STATUSES.includes(value(3) as TestResult["status"]) ? value(3) as TestResult["status"] : "Not Start", createdAt: value(4), testerName: value(5), sourceSheetName: value(6) || undefined, source: value(7) === "sheets" ? "sheets" : "web", editedLocally: true, actualResult: "", apiResponse: "", log: "", evidence: [] };
    } else if (result) {
      if (value(0) === "Actual result") result.actualResult += value(1);
      if (value(0) === "API response") result.apiResponse += value(1);
      if (value(0) === "Log") result.log += value(1);
      if (value(0) === "Evidence") evidence += value(1);
      if (value(0) === "QA metadata") metadata += value(1);
    }
  }
  return { ...caseData, results };
}

export function readStepResultSnapshots(rows: unknown[][], caseId: string, identity?: TestCase["registerIdentity"], allowLegacy = true, allowChangedDefinition = false, ownership?: SnapshotOwnership): TestResult[] {
  return readStepCaseSnapshot(rows, caseId, identity, allowLegacy, allowChangedDefinition, ownership).results;
}
