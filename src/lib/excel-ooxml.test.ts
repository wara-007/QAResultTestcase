import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { strToU8, zipSync } from "fflate";
import { readWorkbookFreeformResults, readWorkbookSheet } from "./excel-ooxml";
import type { WorkbookSource } from "./types";

Object.assign(globalThis, { DOMParser });

function workbook(cells: Array<[string, string]>): WorkbookSource {
  const xml = cells.map(([ref, text]) => `<c r="${ref}" t="inlineStr"><is><t>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</t></is></c>`).join("");
  const bytes = zipSync({ "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData><row>${xml}</row></sheetData></worksheet>`) });
  return {
    fileName: "fixture.xlsx", buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    bufferLoaded: true, sheetName: "Testcase", sheetPath: "", columns: {},
    sheets: [{ name: "RC TC-27", path: "xl/worksheets/sheet1.xml", order: 0, kind: "result", testCaseIds: ["TC-27"], imageCount: 0, hidden: false }],
  };
}

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
