import type { WorkbookSheet } from "./types";
import { sheetSectionsFromCells } from "./sheet-sections";

export function selectDetailSheets(sheets: WorkbookSheet[], options: { sheetName?: string; sheetNames?: string[]; testcaseId?: string } = {}): WorkbookSheet[] {
  const detailSheets = sheets.filter(sheet => sheet.name.trim().toLowerCase() !== "testcase");
  if (options.sheetNames) return [...new Set(options.sheetNames)].flatMap(sheetName => selectDetailSheets(sheets, { sheetName }));
  if (options.sheetName !== undefined) {
    const exact = detailSheets.find(sheet => sheet.name === options.sheetName);
    // Compatibility with old URLs which trimmed the tab title. Never collapse internal spaces.
    const matches = exact ? [exact] : detailSheets.filter(sheet => sheet.name.trim() === options.sheetName?.trim());
    if (matches.length !== 1) throw new Error("ไม่พบแท็บ Google Sheets ที่ระบุ หรือชื่อแท็บไม่ชัดเจน");
    return matches;
  }
  if (options.testcaseId) return detailSheets.filter(sheet => sheet.testCaseIds.some(id => id.toUpperCase() === options.testcaseId?.toUpperCase()));
  return detailSheets;
}

export function freeformTextFromCells(cells: Array<{ ref: string; value: string }>, representedValues: string[] = [], representedRefs: string[] = []) {
  const mappedRefs = new Set(representedRefs);
  const represented = new Map<string, number>();
  representedValues.forEach(value => { if (value.trim()) represented.set(value.trim(), (represented.get(value.trim()) ?? 0) + 1); });
  const content = cells.filter(cell => {
    const value = cell.value.trim();
    if (!value) return false;
    const count = represented.get(value) ?? 0;
    if (mappedRefs.has(cell.ref)) { if (count) represented.set(value, count - 1); return false; }
    if (count) { represented.set(value, count - 1); return false; }
    return true;
  });
  const labels = cells.filter(cell => /^(?:log|logs)[\s_-]*\d*$/i.test(cell.value.trim()));
  const actual: string[] = [], api: string[] = [], logs: string[] = [], unmapped: string[] = [];
  for (const cell of content) {
    const value = cell.value.trim();
    if (/^(?:log|logs)[\s_-]*\d*$/i.test(value)) { unmapped.push(`${cell.ref}: ${value}`); continue; }
    const logLabel = labels.filter(label => label.ref.replace(/\d/g, "") === cell.ref.replace(/\d/g, "") && Number(label.ref.replace(/\D/g, "")) < Number(cell.ref.replace(/\D/g, ""))).at(-1);
    if (logLabel || /kubectl\s+logs|^\s*\$\s+.*\blogs\b|\.log(?::\d+)?:|["']@timestamp["']\s*:|(?:^|\n)\d{4}-\d{2}-\d{2}T[^\n]*\|\s*(?:INFO|ERROR|WARN|DEBUG)\b/i.test(value)) logs.push(`${logLabel ? `${logLabel.value.trim()} · ` : ""}${cell.ref}\n${cell.value}`);
    else if (/(?:^|\n)\s*(?:endpoint|request|response|http status|server|method)\s*:|http inspector|["'](?:status|statusType|errorCode|errorMessage|data|transactionId)["']\s*:/i.test(value) || (/^[\[{]/.test(value) && /["']\w+["']\s*:/.test(value))) api.push(value);
    else if (/^(?:case|result|actual result|ผล(?:การ)?ทดสอบ)\b/i.test(value)) actual.push(value);
    else unmapped.push(`${cell.ref}: ${cell.value}`);
  }
  return {
    actualResult: [actual.join("\n\n"), unmapped.length ? `ข้อมูลเพิ่มเติมจาก Sheets (ยังไม่ได้จัดหมวดหมู่)\n${unmapped.join("\n\n")}` : ""].filter(Boolean).join("\n\n"),
    apiResponse: api.join("\n\n"), log: logs.join("\n\n"),
    sheetSections: sheetSectionsFromCells(content),
  };
}
