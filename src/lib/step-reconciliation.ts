import type { TestCase, TestResult, WorkbookSource } from "./types";
import { isProjectSummarySheet, testCaseIdsMatchingSheetName } from "./sheet-mapping-model";

export function needsStepTemplateRefresh(cases: TestCase[], source: WorkbookSource | null) {
  // Older imports marked the entire tab loaded after saving only its first
  // owner. A tab checkpoint is not proof that every referenced case has results.
  const missingSharedResults = source?.sheets.some(sheet => {
    if (sheet.kind === "summary" || sheet.kind === "defect" || sheet.kind === "testcase") return false;
    const ids = testCaseIdsMatchingSheetName(sheet.name, cases);
    return ids.length > 1 && cases.some(testCase => ids.includes(testCase.id)
      && (!testCase.results?.some(result => result.sourceSheetName === sheet.name)
        || testCase.results.some(result => result.sourceSheetName === sheet.name
          && ((result.id.includes("-API-") && result.sharedSheetMappingVersion !== 3)
            || (result.id.includes("-ROW-") && result.sharedSheetMappingVersion !== 4)))));
  });
  if (missingSharedResults) return true;
  return cases.some(testCase => testCase.stepDefinitions?.some(step => !step.sourceFields)
    || (testCase.stepDefinitions?.length && (testCase.results ?? []).some(result => result.id === `SHEET-IMPORT-${result.sourceSheetName}` && !result.editedLocally))
    || (!testCase.stepDefinitions?.length && /\bstep\s*\d+/i.test(testCase.steps) && source?.sheets.some(sheet => isProjectSummarySheet(sheet.name))));
}

export function replaceLegacyStepPreviews(localResults: TestResult[], freshResults: TestResult[]): TestResult[] {
  const ranges = freshResults.filter(result => result.sourceRange);
  if (!ranges.length) return localResults;
  return localResults.flatMap(result => {
    if (result.editedLocally || result.source === "web" || result.id !== `SHEET-IMPORT-${result.sourceSheetName}` || !ranges.some(fresh => fresh.sourceSheetName === result.sourceSheetName)) return [result];
    const unassigned = result.evidence.filter(evidence => {
      const prefix = `sheet-${result.sourceSheetName}-`.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const row = Number(evidence.name.match(new RegExp(`${escaped}(\\d+)-\\d+`))?.[1]);
      const fresh = ranges.find(fresh => fresh.sourceSheetName === result.sourceSheetName && row >= fresh.sourceRange!.startRow && row <= fresh.sourceRange!.endRow);
      if (!fresh) return true;
      if (!fresh.evidence.some(item => item.fileId === evidence.fileId)) fresh.evidence = [...fresh.evidence, evidence];
      return false;
    });
    return unassigned.length ? [{ ...result, id: `${result.id}-UNASSIGNED`, actualResult: "หลักฐานจากการนำเข้าเดิมที่ยังไม่ผูก Step", apiResponse: "", log: "", sheetSections: undefined, evidence: unassigned }] : [];
  });
}

export function reconcileStepCases(stored: TestCase, incoming: TestCase): { testCase: TestCase; issues: string[] } {
  const issues = [...(incoming.importIssues ?? [])];
  const resolvedNames = new Set(issues.filter(issue => issue.includes(": จับคู่จากเลข Step ")).map(issue => issue.split(": จับคู่จากเลข Step ")[0]));
  const sharedNames = new Set((incoming.results ?? []).filter(result => (result.sharedSheetMappingVersion ?? 0) >= 2).flatMap(result => result.sheetSections?.map(section => section.title.split(" · ผลร่วม:")[0]) ?? []));
  const retainedIssues = (stored.importIssues ?? []).filter(issue => {
    const sharedWarning = /: (?:ไม่พบ Step ที่ตรงกัน|อ้างอิงหลาย Test Case|ยังผูกผลกับ Step ไม่ได้)/.test(issue) && [...sharedNames].some(name => issue.startsWith(`${name}: `));
    return !sharedWarning && (!issue.includes(": ยังผูกผลกับ Step ไม่ได้") || !resolvedNames.has(issue.split(": ยังผูกผลกับ Step ไม่ได้")[0]));
  });
  const local = new Map((stored.stepDefinitions ?? []).map(step => [step.id, step]));
  const stepDefinitions = (incoming.stepDefinitions ?? stored.stepDefinitions ?? []).map(step => {
    const previous = local.get(step.id);
    local.delete(step.id);
    if (!previous) return step;
    if (previous.name !== step.name || previous.description !== step.description || previous.expected !== step.expected) {
      issues.push(`${step.name}: ข้อมูล Step เปลี่ยนใน Sheets (${step.description}) — เก็บข้อมูลเดิมไว้เพื่อให้ QA ตรวจสอบ`);
      return previous;
    }
    // A stored execution is authoritative for QA edits, not for source definitions.
    return stored.persistedLocally ? { ...step, status: previous.status, rawStatus: previous.rawStatus, device: previous.device, environment: previous.environment, appVersion: previous.appVersion, executedBy: previous.executedBy, executedDate: previous.executedDate, resultReference: previous.resultReference, remark: previous.remark } : step;
  });
  for (const step of local.values()) {
    if ((stored.results ?? []).some(result => result.stepId === step.id)) {
      issues.push(`${step.name}: ไม่พบ Step เดิมใน Sheets แต่ยังเก็บไว้เนื่องจากมี Result`);
      stepDefinitions.push(step);
    }
  }
  return { testCase: { ...incoming, stepDefinitions: stepDefinitions.length ? stepDefinitions : undefined, importIssues: [...new Set([...retainedIssues, ...issues])] }, issues };
}
