import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import { exportTestCases, readWorkbookFreeformResults, readWorkbookResultImages, readWorkbookSheet } from "./excel-ooxml";
import { casesFromRows } from "./testcase-rows";
import type { WorkbookSource } from "./types";

Object.assign(globalThis, { DOMParser });
test("combined result evidence remains accessible to both referenced cases", () => {
  const source = workbook([["A1", "API"], ["B1", "Response"], ["C1", "Log"], ["A2", "GET /shared"], ["B2", "ok"]]);
  source.sheets[0].name = "TC01, TC02";
  source.sheets[0].testCaseIds = ["TC01", "TC02"];
  const files = unzipSync(new Uint8Array(source.buffer));
  files["xl/worksheets/sheet1.xml"] = strToU8(strFromU8(files["xl/worksheets/sheet1.xml"]).replace("<worksheet>", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">').replace("</worksheet>", '<drawing r:id="draw1"/></worksheet>'));
  files["xl/worksheets/_rels/sheet1.xml.rels"] = strToU8('<Relationships><Relationship Id="draw1" Target="../drawings/drawing1.xml"/></Relationships>');
  files["xl/drawings/drawing1.xml"] = strToU8('<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><oneCellAnchor><from><row>1</row><col>1</col></from><blip r:embed="img1"/></oneCellAnchor></drawing>');
  files["xl/drawings/_rels/drawing1.xml.rels"] = strToU8('<Relationships><Relationship Id="img1" Target="../media/proof.png"/></Relationships>');
  files["xl/media/proof.png"] = new Uint8Array([137, 80, 78, 71]);
  const bytes = zipSync(files);
  source.buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const cases = casesFromRows([["Test Case Id", "Test Case Name"], ["TC01", "First"], ["TC02", "Second"]]);
  const images = readWorkbookResultImages(source, cases);
  assert.deepEqual(images.map(image => [image.testCaseId, image.resultId]), [["TC01", "SHEET-IMPORT-TC01, TC02-API-2"], ["TC02", "SHEET-IMPORT-TC01, TC02-API-2"]]);
});
test("Step export preserves formula cells, original Cover and detail definitions", () => {
  Object.assign(globalThis, { XMLSerializer });
  const rows = [["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status"], ["ENQ_01_TC_01", "step 01", "Landing", "Correct", "TESTING"]];
  const cells = rows.map((row, index) => `<row r="${index + 1}">${row.map((value, col) => `<c r="${String.fromCharCode(65 + col)}${index + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row>`).join("").replace('<c r="E2" t="inlineStr"><is><t>TESTING</t></is></c>', '<c r="E2"><f>"TESTING"</f><v>TESTING</v></c>');
  const detail = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Original definition</t></is></c></row></sheetData></worksheet>';
  const cover = '<worksheet><sheetData/></worksheet>';
  const bytes = zipSync({ "xl/worksheets/register.xml": strToU8(`<worksheet><sheetData>${cells}</sheetData></worksheet>`), "xl/worksheets/detail.xml": strToU8(detail), "xl/worksheets/cover.xml": strToU8(cover) });
  const source: WorkbookSource = { fileName: "fixture.xlsx", buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, bufferLoaded: true, sheetName: "Testcase", sheetPath: "xl/worksheets/register.xml", columns: {}, sheets: [{ name: "Testcase", path: "xl/worksheets/register.xml", order: 0, kind: "testcase", testCaseIds: [], imageCount: 0, hidden: false }, { name: "ENQ_01_TC_01", path: "xl/worksheets/detail.xml", order: 1, kind: "result", testCaseIds: ["ENQ_01_TC_01"], imageCount: 0, hidden: false }] };
  const testCase = casesFromRows(rows)[0];
  testCase.stepDefinitions![0].status = "Pass";
  const exported = unzipSync(exportTestCases(source, [testCase]));
  assert.match(strFromU8(exported[source.sheetPath]), /<f>"TESTING"<\/f>/);
  assert.equal(strFromU8(exported["xl/worksheets/cover.xml"]), cover);
  assert.match(strFromU8(exported["xl/worksheets/detail.xml"]), /Original definition/);
});

test("reopening the same sheet reuses parsed content while refreshed workbook bytes stay independent", () => {
  const original = workbook([["A1", "old log"]]);
  let parses = 0;
  class CountingParser extends DOMParser {
    parseFromString(...args: Parameters<DOMParser["parseFromString"]>) {
      parses += 1;
      return super.parseFromString(...args);
    }
  }
  Object.assign(globalThis, { DOMParser: CountingParser });
  try {
    const first = readWorkbookSheet(original, original.sheets[0]);
    const initialParses = parses;
    assert.deepEqual(readWorkbookSheet({ ...original }, original.sheets[0]), first);
    assert.equal(parses, initialParses);
    const refreshed = workbook([["A1", "new log"]]);
    assert.equal(readWorkbookSheet(refreshed, refreshed.sheets[0]).cells[0].value, "new log");
  } finally { Object.assign(globalThis, { DOMParser }); }
});

function workbook(cells: Array<[string, string]>): WorkbookSource {
  const xml = cells.map(([ref, text]) => `<c r="${ref}" t="inlineStr"><is><t>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</t></is></c>`).join("");
  const bytes = zipSync({ "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData><row>${xml}</row></sheetData></worksheet>`) });
  return {
    fileName: "fixture.xlsx", buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    bufferLoaded: true, sheetName: "Testcase", sheetPath: "", columns: {},
    sheets: [{ name: "RC TC-27", path: "xl/worksheets/sheet1.xml", order: 0, kind: "result", testCaseIds: ["TC-27"], imageCount: 0, hidden: false }],
  };
}

test("workbook matrix fallback uses the same row result IDs instead of importing the entire tab again", () => {
  const source = workbook([["A1", "Result"], ["A2", "API"], ["B2", "Response"], ["C2", "Log"], ["A3", "GET /home"], ["B3", '{"ok":true}'], ["A4", "GET /usage"], ["B4", "usage response"]]);
  const owner = casesFromRows([["Test Case Id", "Test Case Name"], ["TC-27", "Home"]])[0];
  const results = readWorkbookFreeformResults(source, [owner]);
  assert.deepEqual(results.map(result => result.resultId), ["SHEET-IMPORT-RC TC-27-API-3", "SHEET-IMPORT-RC TC-27-API-4"]);
  assert.ok(results[0].sheetSections?.[0].rows[0].fields.some(field => field.label === "Response" && field.value === '{"ok":true}'));
});

test("freeform import preserves unclassified cells with their coordinates, including repeated text", () => {
  const source = workbook([["A1", "Test Case Id"], ["A2", "TC-27"], ["A34", 'CommonBE_trueapp_Endpoint.log:188:{"level":"INFO"}'], ["B35", "ข้อความไม่ตรงรูปแบบ"], ["C35", "ข้อความไม่ตรงรูปแบบ"], ["D36", "Endpoint: /example"]]);
  const [result] = readWorkbookFreeformResults(source);
  assert.ok(result.log.includes('CommonBE_trueapp_Endpoint.log:188:{"level":"INFO"}'));
  assert.ok(result.actualResult.includes("B35: ข้อความไม่ตรงรูปแบบ"));
  assert.ok(result.actualResult.includes("C35: ข้อความไม่ตรงรูปแบบ"));
  assert.equal(result.apiResponse, "Endpoint: /example");
  assert.ok(!result.actualResult.includes("Endpoint: /example"));
});

test("text-only unclassified tabs still produce an importable result", () => {
  const [result] = readWorkbookFreeformResults(workbook([["A1", "รายละเอียดเพิ่มเติม"], ["Z300", "ท้ายแท็บ"]]));
  assert.ok(result?.actualResult.includes("A1: รายละเอียดเพิ่มเติม"));
  assert.ok(result.actualResult.includes("Z300: ท้ายแท็บ"));
});

test("sheet preview retains every populated cell and the complete long value", () => {
  const long = "log ".repeat(15000);
  const source = workbook([...Array.from({ length: 230 }, (_, i): [string, string] => [`A${i + 1}`, `row ${i + 1}`]), ["ZZ400", long]]);
  const content = readWorkbookSheet(source, source.sheets[0]);
  assert.equal(content.cells.length, 231);
  assert.equal(content.cells.at(-1)?.value, long.trim());
  assert.equal(content.truncatedCellCount, 0);
});
