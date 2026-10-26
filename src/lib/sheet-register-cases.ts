import type { TestCase, WorkbookSheet, ProjectSheetMapping } from "./types";
import { resolveSheetAssociations } from "./sheet-mapping-resolution";
import { registeredTestCases } from "./sheet-mapping-model";
import { isProjectDefectSheet } from "./project-defects";
import { stepHeaderKey } from "./step-testcases";
export function workspaceCasesForRegister(cases: TestCase[], sheets: WorkbookSheet[], mappings: ProjectSheetMapping[]) {
  const register = registeredTestCases(cases);
  const registered = new Set(register);
  // Only tab-preview snapshots may supply a fallback result. Another real
  // case on the same tab owns its own rows, Steps, and evidence.
  const snapshots = cases.filter(item => !registered.has(item));
  const detailSheets = sheets.filter(sheet => sheet.name.trim().toLowerCase() !== "testcase" && !isProjectDefectSheet(sheet.name));
  const associations = resolveSheetAssociations(detailSheets, register, mappings).associations;
  const sheetNames = new Set(detailSheets.map(sheet => sheet.name));
  return register.map(item => {
    const owned = new Set(associations.filter(association => association.testCase.id === item.id).map(association => association.sheet.name));
    const results = (item.results ?? []).filter(result => !result.sourceSheetName || !sheetNames.has(result.sourceSheetName) || owned.has(result.sourceSheetName));
    const keys = new Set(results.map(result => `${result.sourceSheetName}:${result.id}`));
    for (const snapshot of snapshots) for (const result of snapshot.results ?? []) {
      const key = `${result.sourceSheetName}:${result.id}`;
      if (result.sourceSheetName && owned.has(result.sourceSheetName) && !keys.has(key)) { results.push(result); keys.add(key); }
    }
    return { ...item, results: results.map(result => {
      if (result.source === "web" || result.editedLocally || result.stepMappingHistory?.length
        || result.sharedSheetMappingVersion || !/^SHEET-IMPORT-.+-STEP-\d+$/.test(result.id)) return result;
      // Old snapshots kept the Step label as placeholder text and lost its
      // ownership. Recover the heading without waiting for another Sheet import.
      const heading = result.sheetSections?.[0]?.title ?? result.actualResult.match(/^ผลจาก (step\s*\d+)$/i)?.[1];
      if (!heading) return result;
      const explicitDefinition = result.sheetSections?.some(section => section.rows.some(row => row.row === result.sourceRange?.startRow
        && row.fields.some(field => ["descriptionstep", "expectedresult"].includes(stepHeaderKey(field.label)) && field.value.trim())));
      if (!result.stepId && explicitDefinition) return result;
      const matches = (item.stepDefinitions ?? []).filter(step => stepHeaderKey(step.name) === stepHeaderKey(heading));
      if (matches.length !== 1) return result;
      return { ...result, stepId: result.stepId ?? matches[0].id,
        actualResult: result.actualResult === `ผลจาก ${heading}` ? "" : result.actualResult };
    }) };
  });
}
