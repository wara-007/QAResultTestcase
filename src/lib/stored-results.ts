import type { TestCase, TestCaseCustomField, TestDefect, TestResult } from "./types";

type StoredResultPayload = {
  sourceSheetName?: string;
  sourceFields?: TestCase["sourceFields"];
  version: 1 | 2 | 3 | 4;
  stepDefinitions?: TestCase["stepDefinitions"];
  importIssues?: string[];
  resultReference: string;
  results: TestResult[];
  defects?: TestDefect[];
  customFields?: TestCaseCustomField[];
  resultFieldDefinitions?: TestCase["resultFieldDefinitions"];
};

function normalizeDefect(defect: Partial<TestDefect>, fallbackId: string): TestDefect {
  return {
    id: defect.id ?? fallbackId,
    title: defect.title ?? "Defect",
    description: defect.description ?? "",
    status: defect.status ?? "Open",
    jiraUrl: defect.jiraUrl ?? "",
    apiResponse: defect.apiResponse ?? "",
    log: defect.log ?? "",
    evidence: Array.isArray(defect.evidence) ? defect.evidence : [],
    createdAt: defect.createdAt ?? new Date(0).toISOString(),
  };
}

export function parseStoredResults(value: string | undefined) {
  if (!value?.startsWith("qa-results:")) return { resultReference: value ?? "", results: [] as TestResult[], defects: [] as TestDefect[], customFields: [] as TestCaseCustomField[], resultFieldDefinitions: [], persistedLocally: false };
  try {
    const payload = JSON.parse(value.slice("qa-results:".length)) as StoredResultPayload;
    const results = Array.isArray(payload.results) ? payload.results : [];
    const migratedDefects = results.flatMap((result) => (result.defects ?? []).map((defect, index) => normalizeDefect(defect, `${result.id}-defect-${index + 1}`)));
    return {
      sourceFields: Array.isArray(payload.sourceFields) ? payload.sourceFields : undefined,
      sourceSheetName: typeof payload.sourceSheetName === "string" ? payload.sourceSheetName : undefined,
      stepDefinitions: Array.isArray(payload.stepDefinitions) ? payload.stepDefinitions : undefined,
      importIssues: Array.isArray(payload.importIssues) ? payload.importIssues : [],
      resultReference: typeof payload.resultReference === "string" ? payload.resultReference : "",
      results: results.map((result) => {
        const normalized = { ...result };
        delete normalized.defects;
        return normalized;
      }),
      defects: Array.isArray(payload.defects) ? payload.defects.map((defect, index) => normalizeDefect(defect, `defect-${index + 1}`)) : migratedDefects,
      customFields: Array.isArray(payload.customFields) ? payload.customFields : [],
      resultFieldDefinitions: Array.isArray(payload.resultFieldDefinitions) ? payload.resultFieldDefinitions : [],
      persistedLocally: true,
    };
  } catch {
    return { resultReference: "", results: [] as TestResult[], defects: [] as TestDefect[], customFields: [] as TestCaseCustomField[], resultFieldDefinitions: [], persistedLocally: false };
  }
}

export function serializeStoredResults(testCase: TestCase) {
  const payload: StoredResultPayload = { version: 4, sourceFields: testCase.sourceFields, stepDefinitions: testCase.stepDefinitions, importIssues: testCase.importIssues, resultReference: testCase.resultReference, results: testCase.results ?? [], defects: testCase.defects ?? [], customFields: testCase.customFields ?? [], resultFieldDefinitions: testCase.resultFieldDefinitions ?? [] };
  payload.sourceSheetName = testCase.sourceSheetName;
  return `qa-results:${JSON.stringify(payload)}`;
}


