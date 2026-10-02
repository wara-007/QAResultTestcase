import type { WorkbookSheet } from "./types";
import { isProjectDefectSheet } from "./project-defects";

export function withCachedProjectDefects(mapping: Record<string, unknown>, incoming: WorkbookSheet[]): Record<string, unknown> & { sheets: WorkbookSheet[] } {
  const sheets: WorkbookSheet[] = Array.isArray(mapping.sheets) ? [...mapping.sheets] : [];
  for (const sheet of incoming) {
    if (!isProjectDefectSheet(sheet.name) || !Array.isArray(sheet.defects)) continue;
    const index = sheets.findIndex(current => current.name.trim().toLowerCase() === sheet.name.trim().toLowerCase());
    if (index < 0) sheets.push(sheet);
    else sheets[index] = { ...sheets[index], defects: sheet.defects };
  }
  return { ...mapping, sheets };
}
