// Server-side adapter. The browser's existing OOXML reader remains unchanged.
import { DOMParser } from "@xmldom/xmldom";
import { importTestCases, readWorkbookSheet } from "./excel-ooxml";
import { automaticSheetCaseIds } from "./sheet-mapping-model";
import { isProjectSummarySheet } from "./sheet-mapping-model";
import { parseCoverSnapshot } from "./workbook-validation";

export function driveWorkbookType(mimeType: string | null | undefined): "google-sheets" | "xlsx" {
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "google-sheets";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  throw new Error("รองรับ Google Sheets และ Excel .xlsx เท่านั้น กรุณาแปลงไฟล์นี้เป็น .xlsx หรือ Google Sheets");
}

export const OFFICE_SYNC_MESSAGE = "ไฟล์นี้เป็น Excel บน Google Drive สามารถแก้ผลในเว็บและดาวน์โหลดไฟล์ได้ แต่การซิงค์กลับรองรับเฉพาะ Google Sheets กรุณาแปลงไฟล์เป็น Google Sheets ก่อน";

export function officeWorkbookData(buffer: ArrayBuffer, fileName: string) {
  if (typeof globalThis.DOMParser === "undefined") Object.assign(globalThis, { DOMParser });
  const { cases, source } = importTestCases(buffer, fileName);
  source.documentType = "xlsx";
  const rows = new Map<string, string[][]>();
  for (const sheet of source.sheets) {
    sheet.testCaseIds = automaticSheetCaseIds(sheet.name, cases);
    const values: string[][] = [];
    for (const cell of readWorkbookSheet(source, sheet).cells) {
      const position = /^([A-Z]+)(\d+)$/.exec(cell.ref);
      if (!position) continue;
      const column = [...position[1]].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;
      const row = Number(position[2]) - 1;
      (values[row] ??= [])[column] = cell.value;
    }
    rows.set(sheet.name, Array.from({ length: values.length }, (_, index) => values[index] ?? []));
  }
  const cover = source.sheets.find(sheet => isProjectSummarySheet(sheet.name));
  if (cover) source.coverSnapshot = parseCoverSnapshot(rows.get(cover.name) ?? [], cover.name);
  return { cases, source, sheets: source.sheets, rows };
}
