import type { TestCase, WorkbookSheet, WorkbookSource } from "./types";

const titleKey = (name: string) => name.trim().toLowerCase();
const excelTitleLimit = 31;

function workbookTitleAliases(sourceSheets: readonly WorkbookSheet[], googleSheets: readonly WorkbookSheet[]) {
  const googleByTitle = new Map(googleSheets.map(sheet => [titleKey(sheet.name), sheet]));
  const sourceTitles = new Set(sourceSheets.map(sheet => titleKey(sheet.name)));
  const aliases = new Map<string, string>();
  for (const sheet of sourceSheets) {
    const key = titleKey(sheet.name);
    const exact = googleByTitle.get(key);
    if (exact) {
      if (exact.name !== sheet.name) aliases.set(sheet.name, exact.name);
      continue;
    }
    // Google can export a long tab title as its first 31 characters.
    if (sheet.name.length !== excelTitleLimit) continue;
    const candidates = googleSheets.filter(tab => tab.name.length > excelTitleLimit && titleKey(tab.name.slice(0, excelTitleLimit)) === key);
    if (candidates.length === 1 && !sourceTitles.has(titleKey(candidates[0].name))) aliases.set(sheet.name, candidates[0].name);
  }
  return aliases;
}

export function mergeGoogleSheetsWithSource(sourceSheets: readonly WorkbookSheet[], googleSheets: readonly WorkbookSheet[]) {
  const aliases = workbookTitleAliases(sourceSheets, googleSheets);
  const sourceByTitle = new Map(sourceSheets.map(sheet => [titleKey(aliases.get(sheet.name) ?? sheet.name), sheet]));
  return googleSheets.map(googleSheet => {
    const sourceSheet = sourceByTitle.get(titleKey(googleSheet.name));
    if (!sourceSheet) return googleSheet;
    return {
      ...googleSheet,
      path: sourceSheet.path,
      imageCount: sourceSheet.imageCount,
      defects: googleSheet.defects ?? sourceSheet.defects,
    };
  });
}

export function alignGoogleWorkbookImport(imported: { source: WorkbookSource; cases: TestCase[] }, googleSheets: readonly WorkbookSheet[]) {
  const aliases = workbookTitleAliases(imported.source.sheets, googleSheets);
  if (!aliases.size) return imported;
  const title = (name: string) => aliases.get(name) ?? name;
  return {
    source: { ...imported.source, sheets: imported.source.sheets.map(sheet => ({ ...sheet, name: title(sheet.name) })) },
    cases: imported.cases.map(item => item.resultReferenceTargets
      ? { ...item, resultReferenceTargets: item.resultReferenceTargets.map(title) } : item),
  };
}
