import type { ProjectSheetMapping, TestCase, WorkbookSheet } from "./types";
import { automaticSheetCaseIds, referencedSheetCaseIds, caseResultReferences, registeredTestCases, isProjectSummarySheet } from "./sheet-mapping-model";

const identity = (value: string) => value.trim().toLocaleUpperCase().replace(/[\s_-]+/g, "");
const stableSheetKey = (sheet: WorkbookSheet) => sheet.sheetId == null ? `path:${sheet.path}` : `google:${sheet.sheetId}`;

export type SheetAssociation = {
  sheet: WorkbookSheet;
  testCase: TestCase;
  source: "manual" | "automatic";
  mapping?: ProjectSheetMapping;
};

export type InvalidSheetMapping = {
  sheet: WorkbookSheet;
  mapping: ProjectSheetMapping;
  reason: "missing-testcase";
};

export function resolveSheetAssociations(
  sheets: readonly WorkbookSheet[],
  cases: readonly TestCase[],
  mappings: readonly ProjectSheetMapping[],
) {
  const casesByIdentity = new Map(registeredTestCases(cases).map((testCase) => [identity(testCase.id), testCase]));
  const mappingsBySheetId = new Map(mappings.map((mapping) => [mapping.sheetId, mapping]));
  const seen = new Set<string>();
  const associations: SheetAssociation[] = [];
  const unmapped: WorkbookSheet[] = [];
  const invalidMappings: InvalidSheetMapping[] = [];

  for (const sheet of sheets) {
    if (isProjectSummarySheet(sheet.name)) continue;
    const sheetKey = stableSheetKey(sheet);
    if (seen.has(sheetKey)) continue;
    seen.add(sheetKey);

    const referenced = referencedSheetCaseIds(sheet.name, cases, sheets.map(item => item.name));
    if (referenced.length) {
      associations.push(...referenced.map(id => ({ sheet, testCase: casesByIdentity.get(identity(id))!, source: "automatic" as const })));
      continue;
    }

    const mapping = sheet.sheetId == null ? undefined : mappingsBySheetId.get(sheet.sheetId);
    if (mapping) {
      const mappedCase = casesByIdentity.get(identity(mapping.testcaseKey));
      if (mappedCase && caseResultReferences(mappedCase).length) unmapped.push(sheet);
      else if (mappedCase) associations.push({ sheet, testCase: mappedCase, source: "manual", mapping });
      else invalidMappings.push({ sheet, mapping, reason: "missing-testcase" });
      continue;
    }

    // References inside a sheet can mention many unrelated Test Cases (for
    // example the Defected summary). The register Ref takes priority; without it use validated tab/definition IDs;
    // content-only references stay unmapped until QA chooses the target.
    const inferredCases = automaticSheetCaseIds(sheet.name, cases, sheet.definitionCaseIds, sheets.map(item => item.name))
      .map((testCaseId) => casesByIdentity.get(identity(testCaseId)))
      .filter((testCase): testCase is TestCase => Boolean(testCase));
    if (inferredCases.length) associations.push(...inferredCases.map(testCase => ({ sheet, testCase, source: "automatic" as const })));
    else unmapped.push(sheet);
  }

  return { associations, unmapped, invalidMappings };
}
