import assert from "node:assert/strict";
import test, { mock } from "node:test";
import Module, { createRequire } from "node:module";
import { google } from "googleapis";
import { strToU8, zipSync } from "fflate";

// Next aliases this marker during bundling; Node's test runner needs the same
// empty marker to exercise the server module without a running Next server.
const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = loader._load;
const marker = mock.method(loader, "_load", function (this: unknown, ...args: unknown[]) {
  return args[0] === "server-only" ? {} : Reflect.apply(originalLoad, this, args);
});
const { readGoogleSheet, exportGoogleSheetWorkbook, writeGoogleSheetResults, extractGoogleSheetId } = createRequire(__filename)("./google-sheets") as typeof import("./google-sheets");
marker.mock.restore();

const api = google as unknown as { drive: () => unknown; sheets: () => unknown };
const fixture = () => zipSync({
  "xl/workbook.xml": strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Testcase" sheetId="1" r:id="r1"/><sheet name="TC01" sheetId="2" r:id="r2"/></sheets></workbook>'),
  "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="r1" Target="worksheets/register.xml"/><Relationship Id="r2" Target="worksheets/detail.xml"/></Relationships>'),
  "xl/worksheets/register.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Test Case Id</t></is></c><c r="B1" t="inlineStr"><is><t>Test Case Name</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>TC01</t></is></c><c r="B2" t="inlineStr"><is><t>First case</t></is></c></row></sheetData></worksheet>'),
  "xl/worksheets/detail.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Result ID</t></is></c><c r="B1" t="inlineStr"><is><t>Actual Result</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>R1</t></is></c><c r="B2" t="inlineStr"><is><t>Expected screen appears</t></is></c></row></sheetData></worksheet>'),
});
const auth = { getAccessToken: async () => ({ token: "test-token" }) } as Parameters<typeof readGoogleSheet>[1];

test("Office workbook routes download bytes, parse Results, respect summary and refuse sync without Sheets writes", async () => {
  const bytes = fixture();
  const metadata = mock.method(api, "drive", (() => ({ files: { get: async () => ({ data: { name: "Office.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }) } })));
  const sheets = mock.method(api, "sheets", (() => { throw new Error("Office must not call Sheets API"); }));
  const download = mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    assert.match(String(input), /drive\/v3\/files\/office-id\?alt=media/);
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer test-token");
    return new Response(bytes);
  });
  try {
    const summary = await readGoogleSheet("office-id", auth, { summary: true });
    assert.equal(summary.documentType, "xlsx");
    assert.equal(summary.cases.length, 1);
    assert.equal(summary.cases[0].results?.length ?? 0, 0);
    const detail = await readGoogleSheet("office-id", auth, { testcaseId: "TC01" });
    assert.equal(detail.cases[0].results?.find(result => result.id === "R1")?.actualResult, "Expected screen appears");
    assert.deepEqual(new Uint8Array(await exportGoogleSheetWorkbook("office-id", auth)), bytes);
    await assert.rejects(writeGoogleSheetResults("office-id", detail.cases, auth), /ซิงค์กลับรองรับเฉพาะ Google Sheets/);
    assert.equal(sheets.mock.callCount(), 0);
  } finally { metadata.mock.restore(); sheets.mock.restore(); download.mock.restore(); }
});

test("native Google Sheets still reads the register through Sheets API", async () => {
  const metadata = mock.method(api, "drive", (() => ({ files: { get: async () => ({ data: { mimeType: "application/vnd.google-apps.spreadsheet" } }) } })));
  const sheets = mock.method(api, "sheets", (() => ({ spreadsheets: {
    get: async () => ({ data: { properties: { title: "Native" }, sheets: [{ properties: { sheetId: 0, title: "Testcase" } }] } }),
    values: { get: async () => ({ data: { values: [["Test Case Id", "Test Case Name"], ["TC01", "Native case"]] } }) },
  } })));
  try {
    const result = await readGoogleSheet("native-id", auth, { summary: true });
    assert.equal(result.documentType, "google-sheets");
    assert.equal(result.cases[0].name, "Native case");
    assert.equal(sheets.mock.callCount(), 1);
  } finally { metadata.mock.restore(); sheets.mock.restore(); }
});

test("Office Drive links and existing Sheets links yield file IDs", () => {
  const id = "12345678901234567890";
  assert.equal(extractGoogleSheetId(`https://drive.google.com/file/d/${id}/view`), id);
  assert.equal(extractGoogleSheetId(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(extractGoogleSheetId(`https://docs.google.com/spreadsheets/d/${id}/edit`), id);
  assert.equal(extractGoogleSheetId(`https://example.com/open?id=${id}`), "");
});

test("Drive metadata 404 does not block a native Sheet readable through Sheets API", async () => {
  const metadata = mock.method(api, "drive", () => ({ files: { get: async () => { throw Object.assign(new Error("File not found"), { code: 404 }); } } }));
  const sheets = mock.method(api, "sheets", () => ({ spreadsheets: {
    get: async () => ({ data: { properties: { title: "Accessible sheet" }, sheets: [{ properties: { sheetId: 0, title: "Testcase" } }] } }),
    values: { get: async () => ({ data: { values: [["Test Case Id", "Test Case Name"], ["TC01", "Still readable"]] } }) },
  } }));
  try {
    const result = await readGoogleSheet("native-id", auth, { summary: true });
    assert.equal(result.cases[0].name, "Still readable");
    assert.equal(result.documentType, "google-sheets");
  } finally { metadata.mock.restore(); sheets.mock.restore(); }
});

test("Office permission failure explains file selection rather than claiming the file was deleted", async () => {
  const metadata = mock.method(api, "drive", () => ({ files: { get: async () => { throw Object.assign(new Error("File not found"), { code: 404 }); } } }));
  const sheets = mock.method(api, "sheets", () => ({ spreadsheets: {
    get: async () => { throw Object.assign(new Error("This operation is not supported for this document. The document must not be an Office file."), { code: 400 }); },
    values: { get: async () => ({ data: { values: [] } }) },
  } }));
  try { await assert.rejects(readGoogleSheet("office-id", auth), /เลือกไฟล์จาก Google Drive/); }
  finally { metadata.mock.restore(); sheets.mock.restore(); }
});
