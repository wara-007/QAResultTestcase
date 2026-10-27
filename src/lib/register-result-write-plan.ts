import { stepColumnName } from "./step-testcases";
import { caseResultReferences, matchingResultSheetName, hasExplicitResultReference } from './sheet-mapping-model';
import { displayTestCaseId } from './register-case-identity';
import { stepResultSnapshotRows } from './step-sheet-sync';
import type { TestCase } from './types';

/** Allocate separate append ranges when several rows share a result tab. */
export const hasRegisterSnapshotData = (testCase: TestCase) => Boolean(testCase.results?.some(result => result.source !== "sheets" || result.editedLocally) || testCase.defects?.length || testCase.customFields?.some(field => field.source === "detail"));

export function registerResultSnapshotTargets(cases: TestCase[], sheets: { name: string; rowCount: number }[]) {
  const ends = new Map(sheets.map(sheet => [sheet.name, sheet.rowCount]));
  return cases.flatMap(testCase => {
    if (!caseResultReferences(testCase).length && (hasExplicitResultReference(testCase) || !hasRegisterSnapshotData(testCase))) return [];
    const names = [...new Set(testCase.sourceSheetName ? [testCase.sourceSheetName] : caseResultReferences(testCase).length ? caseResultReferences(testCase) : [displayTestCaseId(testCase)])];
    return names.map(name => {
      const sheet = sheets.find(candidate => candidate.name === matchingResultSheetName(name, sheets.map(item => item.name)));
      if (!sheet && sheets.filter(candidate => matchingResultSheetName(name, [candidate.name])).length > 1) throw new Error(`Ref กำกวม: ${name}`);
      if (!sheet) throw new Error(`ไม่พบแท็บผลทดสอบ ${name} ของ ${displayTestCaseId(testCase)} กรุณาอัปเดตจาก Sheets ก่อนซิงค์`);
      const scoped = { ...testCase, results: testCase.results?.filter(result => !result.sourceSheetName || result.sourceSheetName === sheet.name) };
      const values = stepResultSnapshotRows(scoped);
      const startRow = (ends.get(sheet.name) ?? sheet.rowCount) + 1;
      ends.set(sheet.name, startRow + values.length - 1);
      return { testCase: scoped, name: sheet.name, values, startRow };
    });
  });
}

/** Update execution cells only after checking the register row still matches. */
export function buildRegisterExecutionWritePlan(cases: TestCase[], rows: unknown[][]) {
  const editable = new Set(["status", "device", "testData", "appVersion", "environment", "executedBy", "executedDate", "executedTime", "remark"]);
  return cases.flatMap(testCase => {
    const fields = testCase.sourceFields ?? [];
    const id = fields.find(field => field.field === 'id');
    if (!id || String(rows[testCase.sourceRow - 1]?.[id.column] ?? '').trim() !== displayTestCaseId(testCase)) throw new Error('ตำแหน่ง Testcase เปลี่ยน กรุณาอัปเดตจาก Sheets ก่อนซิงค์');
    if (fields.some(field => (!field.field || !editable.has(field.field)) && !String(rows[testCase.sourceRow - 1]?.[field.column] ?? '').startsWith('=') && String(rows[testCase.sourceRow - 1]?.[field.column] ?? '').trim() !== field.value.trim() && !(!field.field && (testCase.customFields ?? []).some(custom => custom.source === 'testcase' && custom.row === testCase.sourceRow && custom.column === field.column && custom.value.trim() === String(rows[testCase.sourceRow - 1]?.[field.column] ?? '').trim())))) throw new Error('รายละเอียด Testcase เปลี่ยน กรุณาอัปเดตจาก Sheets ก่อนซิงค์');
    const customWrites = (testCase.customFields ?? []).filter(field => field.source === "testcase" && field.sheetName === "Testcase" && field.row === testCase.sourceRow && fields.some(source => !source.field && source.column === field.column) && !String(rows[field.row - 1]?.[field.column] ?? "").startsWith("=")).map(field => ({ range: `'Testcase'!${stepColumnName(field.column)}${field.row}`, values: [[field.value]] }));
    return [...customWrites, ...fields.filter(field => field.field && editable.has(field.field) && !String(rows[testCase.sourceRow - 1]?.[field.column] ?? '').startsWith('=')).map(field => ({range: `'Testcase'!${stepColumnName(field.column)}${testCase.sourceRow}`, values: [[String(testCase[field.field!] ?? '')]]}))];
  });
}
