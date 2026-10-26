import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import { exportTestCases, importTestCases, readWorkbookFreeformResults, readWorkbookResultImages, readWorkbookSheet } from "./excel-ooxml";
import { casesFromRows } from "./testcase-rows";
import type { WorkbookSource } from "./types";

Object.assign(globalThis, { DOMParser });
test("compound register IDs do not prevent an evidence workbook from opening", () => {
  const bytes = zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Testcase" r:id="r1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Test Scenario ID</t></is></c><c r="C1" t="inlineStr"><is><t>Test Case Id</t></is></c><c r="D1" t="inlineStr"><is><t>Testcase</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>RF02</t></is></c><c r="C3" t="inlineStr"><is><t>RF02_TC09</t></is></c><c r="D3" t="inlineStr"><is><t>Validate refill</t></is></c></row><row r="4"><c r="C4" t="inlineStr"><is><t>Refill section heading</t></is></c></row></sheetData></worksheet>'),
  });
  const { cases, source } = importTestCases(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "compound.xlsx");
  assert.deepEqual(cases.map(item => item.id), ["RF02_TC09"]);
  assert.equal(source.bufferLoaded, true);
});
test("Excel imports retain original mapped labels and custom blank columns", () => {
  const bytes = zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Testcase" r:id="r1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Test Case Id</t></is></c><c r="B1" t="inlineStr"><is><t>Condition*</t></is></c><c r="C1" t="inlineStr"><is><t>Custom note</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>TC01</t></is></c><c r="B2" t="inlineStr"><is><t>Member</t></is></c></row></sheetData></worksheet>'),
  });
  const item = importTestCases(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "fixture.xlsx").cases[0];
  assert.deepEqual(item.sourceFields?.map(field => [field.label, field.value]), [["Test Case Id", "TC01"], ["Condition*", "Member"], ["Custom note", ""]]);
});
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

test("embedded evidence on an aliased result tab belongs to the register case without a dash", () => {
  const source = workbook([["A1", "Result ID"], ["B1", "Actual Result"], ["A2", "R1"], ["B2", "works"]]);
  source.sheets[0].name = "RC TC01";
  source.sheets[0].testCaseIds = ["TC01"];
  const files = unzipSync(new Uint8Array(source.buffer));
  files["xl/worksheets/sheet1.xml"] = strToU8('<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Result ID</t></is></c><c r="B1" t="inlineStr"><is><t>Actual Result</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>R1</t></is></c><c r="B2" t="inlineStr"><is><t>works</t></is></c></row></sheetData><drawing r:id="draw1"/></worksheet>');
  files["xl/worksheets/_rels/sheet1.xml.rels"] = strToU8('<Relationships><Relationship Id="draw1" Target="../drawings/drawing1.xml"/></Relationships>');
  files["xl/drawings/drawing1.xml"] = strToU8('<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><oneCellAnchor><from><row>1</row><col>1</col></from><blip r:embed="img1"/></oneCellAnchor></drawing>');
  files["xl/drawings/_rels/drawing1.xml.rels"] = strToU8('<Relationships><Relationship Id="img1" Target="../media/proof.png"/></Relationships>');
  files["xl/media/proof.png"] = new Uint8Array([137, 80, 78, 71]);
  const bytes = zipSync(files);
  source.buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const cases = casesFromRows([["Test Case Id", "Test Case Name"], ["TC01", "First"]]);
  const images = readWorkbookResultImages(source, cases);
  assert.equal(images[0].testCaseId, "TC01");
  assert.equal(images[0].resultId, "R1");
  assert.deepEqual([...images[0].bytes], [137, 80, 78, 71]);
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

test("floating screenshots below the last text row belong to the final Step result", () => {
  const source = workbook([["A1", "Test Case (TC ID)"], ["B1", "Step#"], ["C1", "Description Step"], ["D1", "Expected Result"],
    ["A2", "TC_01"], ["B2", "Step1"], ["C2", "Open app"], ["D2", "Landing page"], ["A5", "Result Testing"], ["A6", "Step1"]]);
  source.sheets[0].name = "TC_01";
  source.sheets[0].testCaseIds = ["TC_01"];
  const files = unzipSync(new Uint8Array(source.buffer));
  files["xl/worksheets/sheet1.xml"] = strToU8(strFromU8(files["xl/worksheets/sheet1.xml"])
    .replace("<worksheet>", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">')
    .replace("</worksheet>", '<drawing r:id="draw1"/></worksheet>'));
  files["xl/worksheets/_rels/sheet1.xml.rels"] = strToU8('<Relationships><Relationship Id="draw1" Target="../drawings/drawing1.xml"/></Relationships>');
  files["xl/drawings/drawing1.xml"] = strToU8('<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><oneCellAnchor><from><row>12</row><col>1</col></from><blip r:embed="img1"/></oneCellAnchor></drawing>');
  files["xl/drawings/_rels/drawing1.xml.rels"] = strToU8('<Relationships><Relationship Id="img1" Target="../media/proof.png"/></Relationships>');
  files["xl/media/proof.png"] = new Uint8Array([137, 80, 78, 71]);
  const bytes = zipSync(files);
  source.buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const owner = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result"], ["TC_01", "Step1", "Open app", "Landing page"]])[0];
  const [image] = readWorkbookResultImages(source, [owner]);
  const [result] = readWorkbookFreeformResults(source, [owner]);
  assert.equal(image.resultId, "SHEET-IMPORT-TC_01-STEP-6");
  assert.equal(result.resultId, image.resultId);
  assert.equal(result.stepId, "Testcase:2");
  assert.deepEqual(result.sourceRange, { startRow: 6, endRow: 13 });
});

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


test("workbook import resolves result tabs through register Ref including annotated IDs", () => {
  const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  const rows = [["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Ref Result Testing"],
    ["FG01_TC01", "Step 01", "Open", "Works", "FG01"],
    ["FG01_TC02", "Step 01", "Open", "Works", "FG01"],
    ["DCB01_TC01\n*U01", "Step 01", "Open", "Works", "DCB01_TC01"]];
  const xml = `<worksheet><sheetData>${rows.map((row, i) => `<row r="${i+1}">${row.map((value, col) => `<c r="${String.fromCharCode(65+col)}${i+1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const bytes = zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Testcase" r:id="r1"/><sheet name="FG01" r:id="r2"/><sheet name="DCB01_TC01" r:id="r3"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/><Relationship Id="r3" Target="worksheets/sheet3.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(xml),
    "xl/worksheets/sheet2.xml": strToU8('<worksheet><sheetData/></worksheet>'),
    "xl/worksheets/sheet3.xml": strToU8('<worksheet><sheetData/></worksheet>'),
  });
  const imported = importTestCases(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "refs.xlsx");
  assert.deepEqual(imported.source.sheets.find(sheet => sheet.name === "FG01")?.testCaseIds, ["FG01_TC01", "FG01_TC02"]);
  assert.deepEqual(imported.source.sheets.find(sheet => sheet.name === "DCB01_TC01")?.testCaseIds, ["DCB01_TC01\n*U01"]);
});

test("freeform ownership follows register Ref even when another case ID equals the tab name", () => {
  const source = workbook([["A1", "Result Testing"], ["A2", "proof text"]]);
  source.sheets[0].name = "TC_01";
  source.sheets[0].testCaseIds = ["TC_02"];
  const cases = casesFromRows([["Test Case Id", "Test Case Name"], ["TC_01", "First"], ["TC_02", "Second"]]);
  cases[0].resultReference = "Other proof";
  cases[1].resultReference = "TC_01";
  assert.deepEqual(readWorkbookFreeformResults(source, cases).map(result => result.testCaseId), ["TC_02"]);
});

test("an unreferenced tab named like a real case stays available as raw preview without attaching its result", () => {
  const source = workbook([["A1", "Result Testing"], ["A2", "unrelated proof"]]);
  source.sheets[0].name = "TC01";
  source.sheets[0].testCaseIds = [];
  const cases = casesFromRows([["Test Case Id", "Test Case Name", "Ref (Result Testing)"], ["TC01", "First", "Proof B"]]);
  assert.deepEqual(readWorkbookFreeformResults(source, cases), []);
  assert.ok(readWorkbookSheet(source, source.sheets[0]).cells.some(cell => cell.value === "unrelated proof"));
});

test("stale cached owner IDs on a differently named tab cannot override the current Ref", () => {
  const source = workbook([["A1", "Result Testing"], ["A2", "old proof"]]);
  source.sheets[0].name = "Old results";
  source.sheets[0].testCaseIds = ["TC-01"];
  const cases = casesFromRows([["Test Case Id", "Test Case Name", "Ref (Result Testing)"], ["TC-01", "First", "Proof B"]]);
  assert.ok(readWorkbookFreeformResults(source, cases).every(result => result.testCaseId !== "TC-01"));
});

test("an unreferenced canonical case-ID alias cannot become the import owner", () => {
  const source = workbook([["A1", "Result Testing"], ["A2", "unrelated proof"]]);
  source.sheets[0].name = "TC1";
  source.sheets[0].testCaseIds = [];
  const cases = casesFromRows([["Test Case Id", "Test Case Name", "Ref (Result Testing)"], ["TC01", "First", "Proof B"]]);
  assert.deepEqual(readWorkbookFreeformResults(source, cases), []);
});

test("Excel separates Result Testing status from the explicit Ref column", () => {
  const rows = [["Testcase ID", "Test Case Name", "Expected Result", "Result Testing", "Ref\n(Result Testing)"], ["CAN_01_TC01", "Cancel", "Cancellation shown", "PASSED", "CAN_02"]];
  const xml = `<worksheet><sheetData>${rows.map((row, i) => `<row r="${i+1}">${row.map((value, col) => `<c r="${String.fromCharCode(65+col)}${i+1}" t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const bytes = zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Testcase" r:id="r1"/><sheet name="CAN_02" r:id="r2"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(xml), "xl/worksheets/sheet2.xml": strToU8('<worksheet><sheetData/></worksheet>'),
  });
  const { cases, source } = importTestCases(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer, "payban.xlsx");
  assert.equal(cases[0].status, "Pass");
  assert.equal(cases[0].resultReference, "CAN_02");
  assert.equal(source.columns.resultReference, "E");
  assert.deepEqual(source.sheets.find(sheet => sheet.name === "CAN_02")!.testCaseIds, ["CAN_01_TC01"]);
});

test('every Ref owner receives generic proof even when the compact definition lists only one case',()=>{
 const source=workbook([['A1','Testcase ID'],['B1','Test Steps'],['C1','Expected Result'],['A2','TC01'],['B2','Open'],['C2','Works'],['A4','Result'],['A5','Shared proof']]);
 const cases=casesFromRows([['Testcase ID','Test Case Name','Ref (Result Testing)'],['TC01','First','RC TC-27'],['TC02','Second','RC TC-27']]);
 const imported=readWorkbookFreeformResults(source,cases);
 assert.equal(imported.filter(r=>r.testCaseId==='TC01').length,1);
 assert.equal(imported.filter(r=>r.testCaseId==='TC02').length,1);
});

test('freeform shared Ref is read for each independent register row',()=>{
 const source=workbook([['A1','Shared screenshot result']]);
 const cases=casesFromRows([['Testcase ID','Test Case Name','Ref (Result Testing)'],['TC01','First','RC TC-27'],['TC02','Second','RC TC-27']]);
 assert.deepEqual(readWorkbookFreeformResults(source,cases).map(r=>r.testCaseId),['TC01','TC02']);
});

test('export and reopen retain duplicate source IDs and independent QA results in their shared Ref tab',()=>{
 Object.assign(globalThis,{XMLSerializer});
 const xmlRow=(number:number,values:string[])=>`<row r="${number}">${values.map((value,index)=>`<c r="${String.fromCharCode(65+index)}${number}" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`;
 const bytes=zipSync({
  'xl/workbook.xml':strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Testcase" r:id="r1"/><sheet name="Proof" r:id="r2"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>'),
  'xl/worksheets/sheet1.xml':strToU8(`<worksheet><sheetData>${xmlRow(1,['Testcase ID','Test Case Name','Ref (Result Testing)','Status'])}${xmlRow(2,['TC01','First','Proof','Pass'])}${xmlRow(3,['TC01','Second','Proof','Pass'])}</sheetData></worksheet>`),
  'xl/worksheets/sheet2.xml':strToU8(`<worksheet><sheetData>${xmlRow(1,['Shared source proof'])}</sheetData></worksheet>`),
 });
 const imported=importTestCases(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'duplicate.xlsx');
 for(const item of imported.cases)item.results=[{id:`QA-${item.sourceRow}`,source:'web',status:'Pass',actualResult:item.name,apiResponse:'',log:'',evidence:[],createdAt:''}];
 const exported=exportTestCases(imported.source,imported.cases);
 const reopened=importTestCases(exported.buffer.slice(exported.byteOffset,exported.byteOffset+exported.byteLength) as ArrayBuffer,'duplicate.xlsx');
 const proof=readWorkbookFreeformResults(reopened.source,reopened.cases);
 for(const item of reopened.cases){
  assert.equal(item.sourceFields?.find(field=>field.field==='id')?.value,'TC01');
  assert.deepEqual(proof.filter(result=>result.testCaseId===item.id && result.resultId.startsWith('QA-')).map(result=>result.actualResult),[item.name]);
 }
 assert.deepEqual(reopened.source.sheets.map(sheet=>sheet.name),['Testcase','Proof']);
});

test('Excel reimport restores owned defect and detail custom metadata from safe snapshots', async () => {
  const { stepResultSnapshotRows } = await import('./step-sheet-sync');
  const owner = casesFromRows([['Test Case Id','Test Case Name','Ref (Result Testing)'],['TC01','First','Proof']])[0];
  owner.defects = [{ id: 'web-defect', title: 'Broken', status: 'Open', jiraUrl: '', description: 'details', apiResponse: '', log: '', createdAt: '2026-10-26T00:00:00Z', evidence: [] }];
  owner.customFields = [{key:'detail:extra',label:'Extra',value:'retained',source:'detail',sheetName:'Proof',row:2,column:1}];
  const xml = (rows: string[][]) => `<worksheet><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((value,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${value.replaceAll('&','&amp;').replaceAll('<','&lt;')}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const bytes=zipSync({
    'xl/workbook.xml':strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Testcase" r:id="r1"/><sheet name="Proof" r:id="r2"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml':strToU8(xml([['Test Case Id','Test Case Name','Ref (Result Testing)'],['TC01','First','Proof']])),
    'xl/worksheets/sheet2.xml':strToU8(xml(stepResultSnapshotRows(owner))),
  });
  const imported=importTestCases(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'snapshot.xlsx');
  assert.deepEqual(imported.cases[0].defects,owner.defects);
  assert.ok(imported.cases[0].customFields?.some(field=>field.key==='detail:extra' && field.value==='retained'));
});
