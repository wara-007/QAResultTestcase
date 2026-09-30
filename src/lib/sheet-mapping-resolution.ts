import type { ProjectSheetMapping, TestCase, WorkbookSheet } from "./types";
import { testCaseIdsFromSheetText } from "./sheet-mapping-model";

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
  const casesByIdentity = new Map(cases.map((testCase) => [identity(testCase.id), testCase]));
  const mappingsBySheetId = new Map(mappings.map((mapping) => [mapping.sheetId, mapping]));
  const seen = new Set<string>();
  const associations: SheetAssociation[] = [];
  const unmapped: WorkbookSheet[] = [];
  const invalidMappings: InvalidSheetMapping[] = [];

  for (const sheet of sheets) {
    const sheetKey = stableSheetKey(sheet);
    if (seen.has(sheetKey)) continue;
    seen.add(sheetKey);

    const mapping = sheet.sheetId == null ? undefined : mappingsBySheetId.get(sheet.sheetId);
    if (mapping) {
      const mappedCase = casesByIdentity.get(identity(mapping.testcaseKey));
      if (mappedCase) associations.push({ sheet, testCase: mappedCase, source: "manual", mapping });
      else invalidMappings.push({ sheet, mapping, reason: "missing-testcase" });
      continue;
    }

    // References inside a sheet can mention many unrelated Test Cases (for
    // example the Defected summary). Only the tab name is safe to infer from;
    // content-only references stay unmapped until QA chooses the target.
    const inferredCase = testCaseIdsFromSheetText(sheet.name)
      .map((testCaseId) => casesByIdentity.get(identity(testCaseId)))
      .find((testCase): testCase is TestCase => Boolean(testCase));
    if (inferredCase) associations.push({ sheet, testCase: inferredCase, source: "automatic" });
    else unmapped.push(sheet);
  }

  return { associations, unmapped, invalidMappings };
}
