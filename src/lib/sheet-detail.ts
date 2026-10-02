import type { WorkbookSheet } from "./types";

export function selectDetailSheets(sheets: WorkbookSheet[], options: { sheetName?: string; testcaseId?: string } = {}) {
  const detailSheets = sheets.filter(sheet => sheet.name.trim().toLowerCase() !== "testcase");
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

export function freeformTextFromCells(cells: Array<{ ref: string; value: string }>) {
  const normalize = (value: string) => value.toLowerCase().replace(/[*]/g, "").replace(/\s+/g, " ").trim();
  const metadataHeader = cells.find(cell => ["test case id", "testcase id"].includes(normalize(cell.value)));
  const metadataRow = metadataHeader ? Number(metadataHeader.ref.replace(/\D/g, "")) : 0;
  const content = cells.filter(cell => cell.value.trim() && (!metadataRow || Number(cell.ref.replace(/\D/g, "")) > metadataRow + 1));
  const labels = content.filter(cell => /^(?:log|logs)$/i.test(cell.value.trim()));
  const actual: string[] = [], api: string[] = [], logs: string[] = [], unmapped: string[] = [];
  for (const cell of content) {
    const value = cell.value.trim();
    if (/^(?:log|logs)$/i.test(value)) continue;
    const logSection = labels.some(label => label.ref.replace(/\d/g, "") === cell.ref.replace(/\d/g, "") && Number(label.ref.replace(/\D/g, "")) < Number(cell.ref.replace(/\D/g, "")));
    if (logSection || /kubectl\s+logs|^\s*\$\s+.*\blogs\b|\.log(?::\d+)?:|["']@timestamp["']\s*:|(?:^|\n)\d{4}-\d{2}-\d{2}T[^\n]*\|\s*(?:INFO|ERROR|WARN|DEBUG)\b/i.test(value)) logs.push(value);
    else if (/(?:^|\n)\s*(?:endpoint|request|response|http status|server|method)\s*:|http inspector|["'](?:status|statusType|errorCode|errorMessage|data|transactionId)["']\s*:/i.test(value) || (/^[\[{]/.test(value) && /["']\w+["']\s*:/.test(value))) api.push(value);
    else if (/^(?:case|result|actual result|ผล(?:การ)?ทดสอบ)\b/i.test(value)) actual.push(value);
    else unmapped.push(`${cell.ref}: ${value}`);
  }
  return {
    actualResult: [actual.join("\n\n"), unmapped.length ? `ข้อมูลเพิ่มเติมจาก Sheets (ยังไม่ได้จัดหมวดหมู่)\n${unmapped.join("\n\n")}` : ""].filter(Boolean).join("\n\n"),
    apiResponse: api.join("\n\n"), log: logs.join("\n\n"),
  };
}
