import type { TestCase, TestDefect } from "./types";

const normalized = (value: unknown) => String(value ?? "").toLowerCase().replace(/[\n\r*._()/-]+/g, " ").replace(/\s+/g, " ").trim();
export const isProjectDefectSheet = (name: string) => ["defected", "defects", "defect"].includes(normalized(name));

export function projectDefectsFromRows(rows: unknown[][], sheetName: string): TestDefect[] {
  const start = rows.findIndex(row => row.some(cell => ["defect id", "defected id"].includes(normalized(cell))));
  if (start < 0) return [];
  const headers = rows[start].map(normalized);
  const value = (row: unknown[], ...aliases: string[]) => {
    const text = String(row[headers.findIndex(header => aliases.includes(header))] ?? "").trim();
    const link = text.match(/^=HYPERLINK\(\s*"((?:[^"]|"")*)"\s*[,;]\s*"((?:[^"]|"")*)"\s*\)$/i);
    return link ? link[aliases.includes("jira") ? 1 : 2].replaceAll('""', '"') : text;
  };
  return rows.slice(start + 1).flatMap(row => {
    const id = value(row, "defect id", "defected id");
    if (!id) return [];
    const description = value(row, "defect description", "defected description", "description");
    return [{ id, title: value(row, "defect title", "title") || description || id, description,
      status: value(row, "status", "defect status") || "Open", jiraUrl: value(row, "jira card", "jira url", "jira"),
      apiResponse: value(row, "api response", "response"), log: value(row, "log", "logs"), evidence: [],
      createdAt: value(row, "report date", "created at"), sourceSheetName: sheetName,
      platform: value(row, "platform"), appVersion: value(row, "app version"), reporter: value(row, "reporter"),
      testCaseReference: value(row, "ref testcase", "testcase", "test case id"), rcReference: value(row, "ref rc"),
    }];
  });
}

export function collectProjectDefects(caseDefects: TestDefect[], sheetDefects: TestDefect[]) {
  const records = new Map<string, TestDefect>();
  for (const defect of [...caseDefects, ...sheetDefects]) {
    const key = defect.id.trim().toUpperCase();
    const previous = records.get(key);
    records.set(key, previous ? { ...previous, ...defect, testCaseReference: defect.testCaseReference || previous.testCaseReference, evidence: defect.evidence.length ? defect.evidence : previous.evidence } : defect);
  }
  const byJira = new Map<string, TestDefect>();
  for (const defect of records.values()) {
    const key = defect.jiraUrl.trim().toLowerCase() || `id:${defect.id.trim().toUpperCase()}`;
    const previous = byJira.get(key);
    byJira.set(key, previous ? { ...previous, ...defect, testCaseReference: defect.testCaseReference || previous.testCaseReference, evidence: defect.evidence.length ? defect.evidence : previous.evidence } : defect);
  }
  return [...byJira.values()];
}

export function summarizeProjectDefects(defects: TestDefect[]) {
  const closed = defects.filter(defect => ["closed", "resolved", "pass", "passed"].includes(defect.status.trim().toLowerCase())).length;
  return { total: defects.length, closed, open: defects.length - closed };
}
export function defectRecordsForSync(cases: TestCase[], registeredDefects: TestDefect[]) {
  const caseDefectRecords = cases.flatMap(testCase => (testCase.defects ?? []).map(defect => ({ testCase, defect })));
  const missingRegistered = registeredDefects.filter(defect => !caseDefectRecords.some(record => record.defect.id === defect.id || Boolean(defect.jiraUrl && record.defect.jiraUrl === defect.jiraUrl)));
  const usedIds = new Set(registeredDefects.map(defect => defect.id.toUpperCase()));
  let nextDefectId = 1;
  return [...caseDefectRecords, ...missingRegistered.map(defect => ({ defect, testCase: { ...cases[0], id: defect.testCaseReference || "", sourceRow: 0, platform: defect.platform || "", appVersion: defect.appVersion || "", executedBy: defect.reporter || "" } }))].map(record => {
    const registered = registeredDefects.find(defect => defect.id === record.defect.id || Boolean(defect.jiraUrl && defect.jiraUrl === record.defect.jiraUrl));
    let displayId = registered?.id;
    if (!displayId) {
      while (usedIds.has(`DEF-${String(nextDefectId).padStart(2, "0")}`)) nextDefectId++;
      displayId = `DEF-${String(nextDefectId++).padStart(2, "0")}`;
      usedIds.add(displayId);
    }
    return { ...record, displayId };
  });
}
