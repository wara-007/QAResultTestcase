import type { TestCase, WorkbookSheet, ProjectSheetMapping } from "./types";
import { resolveSheetAssociations } from "./sheet-mapping-resolution";
import { registeredTestCases } from "./sheet-mapping-model";
import { isProjectDefectSheet } from "./project-defects";
export function workspaceCasesForRegister(cases: TestCase[], sheets: WorkbookSheet[], mappings: ProjectSheetMapping[]) {
  const register = registeredTestCases(cases);
  const detailSheets = sheets.filter(sheet => sheet.name.trim().toLowerCase() !== "testcase" && !isProjectDefectSheet(sheet.name));
  const associations = resolveSheetAssociations(detailSheets, register, mappings).associations;
  const sheetNames = new Set(detailSheets.map(sheet => sheet.name));
  return register.map(item => {
    const owned = new Set(associations.filter(association => association.testCase.id === item.id).map(association => association.sheet.name));
    const results = (item.results ?? []).filter(result => !result.sourceSheetName || !sheetNames.has(result.sourceSheetName) || owned.has(result.sourceSheetName));
    const keys = new Set(results.map(result => `${result.sourceSheetName}:${result.id}`));
    for (const snapshot of cases) for (const result of snapshot.results ?? []) {
      const key = `${result.sourceSheetName}:${result.id}`;
      if (result.sourceSheetName && owned.has(result.sourceSheetName) && !keys.has(key)) { results.push(result); keys.add(key); }
    }
    return { ...item, results };
  });
}
