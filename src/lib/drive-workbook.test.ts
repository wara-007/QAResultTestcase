import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { driveWorkbookType, officeWorkbookData } from "./drive-workbook";
import { readWorkbookStyledText } from "./excel-ooxml";

test("Drive workbook MIME determines reading strategy, never the file extension", () => {
  assert.equal(driveWorkbookType("application/vnd.google-apps.spreadsheet"), "google-sheets");
  assert.equal(driveWorkbookType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "xlsx");
  assert.throws(() => driveWorkbookType("application/vnd.ms-excel"), /xlsx/);
  assert.throws(() => driveWorkbookType("application/pdf"), /รองรับ/);
});

test("Office import uses the register, preserves all detail cells and keeps unmatched tabs separate", () => {
  const xml = (rows: string[][]) => `<worksheet><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const names = ["Testcase", "RC TC01", "Other", "Cover"];
  const bytes = zipSync({
    "xl/workbook.xml": strToU8(`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="r${i}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships>${names.map((_, i) => `<Relationship Id="r${i}" Target="worksheets/sheet${i}.xml"/>`).join("")}</Relationships>`),
    "xl/worksheets/sheet0.xml": strToU8(xml([["Test Case Id", "Test Case Name"], ["TC01", "First"]])),
    "xl/worksheets/sheet1.xml": strToU8(xml([["Result ID", "Actual Result"], ["R1", "works"], ["", "extra log"]])),
    "xl/worksheets/sheet2.xml": strToU8(xml([["Unmapped data", "retained"]]).replace('<c r="B1"', '<c s="0" r="B1"').replace('</worksheet>', '<hyperlinks><hyperlink ref="B1" location="https://example.com/evidence"/></hyperlinks></worksheet>')),
    "xl/styles.xml": strToU8('<styleSheet><fonts><font><b/><color rgb="FF1155CC"/></font></fonts><fills><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills><cellXfs><xf fontId="0" fillId="0"/></cellXfs></styleSheet>'),
    "xl/worksheets/sheet3.xml": strToU8(xml([["Summary"]])),
  });
  const result = officeWorkbookData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "Office.xlsx");
  assert.deepEqual(result.cases.map(item => item.id), ["TC01"]);
  assert.deepEqual(result.sheets.find(sheet => sheet.name === "RC TC01")?.testCaseIds, ["TC01"]);
  assert.deepEqual(result.sheets.find(sheet => sheet.name === "Other")?.testCaseIds, []);
  assert.equal(result.sheets[1].sheetId, 2);
  assert.equal(result.rows.get("RC TC01")?.[2][1], "extra log");
  assert.equal(result.source.documentType, "xlsx");
  const styled = readWorkbookStyledText(result.source, result.sheets[2]).find(cell => cell.ref === "B1");
  assert.equal(styled?.link, "https://example.com/evidence");
  assert.equal(styled?.color, "#1155cc");
  assert.equal(styled?.background, "#ffff00");
  assert.equal(styled?.bold, true);
});
