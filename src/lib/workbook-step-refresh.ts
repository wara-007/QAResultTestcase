import type { TestResult, TestCase, WorkbookFreeformResult, WorkbookResultImage } from "./types";

/** Repair cached evidence ownership without uploading files or replacing live text. */
export function refreshWorkbookStepEvidence(cases: TestCase[], fresh: WorkbookFreeformResult[], images: Pick<WorkbookResultImage, "sheetName" | "testCaseId" | "resultId" | "row" | "column">[]): TestCase[] {
  return cases.map(testCase => {
    const updates = fresh.filter(result => result.testCaseId === testCase.id && /-STEP-\d+$/.test(result.resultId));
    if (!updates.length) return testCase;
    const results = (testCase.results ?? []).map(result => {
      const update = updates.find(item => item.resultId === result.id && item.sheetName === result.sourceSheetName);
      return update && result.source !== "web" && !result.editedLocally
        ? { ...result, stepSheetMappingVersion: update.stepSheetMappingVersion ?? 1 as const, sourceRange: update.sourceRange,
          ...(!result.stepMappingHistory?.length ? { stepId: update.stepId } : {}), evidence: [...result.evidence] }
        : { ...result, evidence: [...result.evidence] };
    });
    const emptied = new Set<string>();
    for (const image of images.filter(image => image.testCaseId === testCase.id)) {
      const target = results.find(result => result.id === image.resultId && result.sourceSheetName === image.sheetName);
      if (!target || target.editedLocally || target.source === "web") continue;
      const key = `sheet-${image.sheetName}-${image.row}-${image.column}-`.replace(/[^a-zA-Z0-9._-]+/g, "_");
      for (const previous of results) {
        if (previous === target || previous.id !== `SHEET-IMPORT-${image.sheetName}-UNASSIGNED`
          || previous.editedLocally || previous.source === "web" || previous.stepMappingHistory?.length) continue;
        const matching = previous.evidence.filter(evidence => evidence.name.includes(key));
        if (!matching.length) continue;
        target.evidence.push(...matching.filter(evidence => !target.evidence.some(item => item.fileId === evidence.fileId)));
        previous.evidence = previous.evidence.filter(evidence => !matching.includes(evidence));
        if (!previous.evidence.length && !previous.apiResponse && !previous.log && !previous.sheetSections?.length
          && (!previous.actualResult || previous.actualResult === `นำเข้าจาก Google Sheets · ${image.sheetName}`
            || previous.actualResult === "หลักฐานจากการนำเข้าเดิมที่ยังไม่ผูก Step")) emptied.add(previous.id);
      }
    }
    return { ...testCase, results: results.filter(result => !emptied.has(result.id)) };
  });
}

/** Workbook text is a fallback for imported snapshots, never for QA edits. */
export function workbookResultFallback(existing: TestResult, fresh: Pick<WorkbookFreeformResult, "sheetName" | "actualResult" | "apiResponse" | "log" | "sheetSections">): TestResult {
  const result = { ...existing, sourceSheetName: existing.sourceSheetName || fresh.sheetName };
  if (existing.source === "web" || existing.editedLocally || existing.sheetSections) return result;
  return { ...result, actualResult: fresh.actualResult || existing.actualResult,
    apiResponse: fresh.apiResponse || existing.apiResponse, log: fresh.log || existing.log, sheetSections: fresh.sheetSections };
}
