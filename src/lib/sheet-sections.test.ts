import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetSectionsFromCells, sectionLogGroups, combineSheetFields, sectionsForDisplay, sectionFieldsForDisplay, isCodeSheetField, groupSheetResultSections, evidenceSectionIndex } from "./sheet-sections";
import { sheetFieldDisplayLabel, isSheetPayloadLabel } from "./sheet-sections";

test("parallel payload lines must not become label/value form fields", () => {
  assert.equal(isSheetPayloadLabel('"groupType": "OTHER",'), true);
  assert.equal(isSheetPayloadLabel("}"), true);
  assert.equal(isSheetPayloadLabel("curl 'https://example.test'"), true);
  assert.equal(isSheetPayloadLabel("Device"), false);
  assert.equal(isSheetPayloadLabel("Environment"), false);
});

test("IR Voice parallel fragments include unheaded curl and scalar JSON array lines", () => {
  const [section] = sheetSectionsFromCells([
    { ref: "W88", value: "core" }, { ref: "Y88", value: "profile" },
    { ref: "T89", value: "curl --location 'https://example.test' \\" },
    { ref: "W89", value: "{" }, { ref: "Y89", value: "{" },
    { ref: "T90", value: "--header 'Accept: application/json'" },
    { ref: "W90", value: '"items": [' }, { ref: "Y90", value: '"status": "ok"' },
    { ref: "W91", value: '"voice",' }, { ref: "Y91", value: "}" },
    { ref: "W92", value: '"data"' }, { ref: "W93", value: "]" }, { ref: "W94", value: "}" },
  ]);
  section.rows.find(row => row.row === 91)!.fields[0].highlights = [{ start: 1, end: 6, color: "red" }];
  const displayed = sectionFieldsForDisplay(section);
  assert.equal(displayed.length, 3);
  assert.equal(displayed.find(field => field.label === "core")?.value, '{\n"items": [\n"voice",\n"data"\n]\n}');
  assert.deepEqual(displayed.find(field => field.label === "core")?.highlights, [{ start: 14, end: 19, color: "red" }]);
  assert.equal(displayed.find(field => field.label === "profile")?.value, '{\n"status": "ok"\n}');
  assert.ok(displayed.some(field => field.value === "curl --location 'https://example.test' \\\n--header 'Accept: application/json'"));
});

test("unheaded vertical JSON and kubectl logs join without swallowing ordinary notes or complete responses", () => {
  const sections = sheetSectionsFromCells([
    { ref: "A1", value: "kubectl logs deployment/core" },
    { ref: "A2", value: '{"@timestamp":"first"}' }, { ref: "A3", value: '{"@timestamp":"second"}' },
    { ref: "C1", value: "note" }, { ref: "C2", value: "confirmed" },
    { ref: "E1", value: '{"one":1}' }, { ref: "E2", value: '{"two":2}' },
    { ref: "A8", value: "{" }, { ref: "A9", value: '"incomplete": [' }, { ref: "A10", value: "123," },
  ]);
  const first = sectionFieldsForDisplay(sections[0]);
  assert.ok(first.some(field => field.value === 'kubectl logs deployment/core\n{"@timestamp":"first"}\n{"@timestamp":"second"}'));
  assert.ok(first.some(field => field.value === "confirmed"));
  assert.equal(first.filter(field => field.ref.startsWith("E")).length, 2);
  assert.equal(sectionFieldsForDisplay(sections[1])[0].value, '{\n"incomplete": [\n123,');
});

test("blank rows within a column separate JSON runs even when a parallel column continues", () => {
  const [section] = sheetSectionsFromCells([
    { ref: "A1", value: "{" }, { ref: "A2", value: '"first": 1' }, { ref: "A3", value: "}" },
    { ref: "C4", value: "keep this note" },
    { ref: "A5", value: "{" }, { ref: "A6", value: '"second": 2' }, { ref: "A7", value: "}" },
  ]);
  assert.deepEqual(sectionFieldsForDisplay(section).map(field => field.value), ["keep this note", '{\n"first": 1\n}', '{\n"second": 2\n}']);
});

test("two headed columns of JSON fragments stay separate with their own highlights", () => {
  const [section] = sheetSectionsFromCells([
    { ref: "F1", value: "Home page\n/core/api/v2/home/profile" },
    { ref: "G1", value: "Usage summary page\n/core/api/v2/usage/pocketAndUsage" },
    { ref: "F2", value: '"usageSummaryList": [' }, { ref: "G2", value: '"usageSummaryList": [' },
    { ref: "F3", value: "{" }, { ref: "G3", value: "{" },
    { ref: "F4", value: '"quotaType": "NO-USE-NO-PAY",' }, { ref: "G4", value: '"quota": null,' },
    { ref: "F5", value: "}" }, { ref: "G5", value: "}" },
    { ref: "F6", value: "]" }, { ref: "G6", value: "]," },
    { ref: "G7", value: '"creditLimit": null' },
  ]);
  section.rows.find(row => row.row === 4)!.fields[0].highlights = [{ start: 0, end: 11, bold: true }];
  const fields = sectionFieldsForDisplay(section);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].label, "Home page\n/core/api/v2/home/profile");
  assert.equal(fields[1].label, "Usage summary page\n/core/api/v2/usage/pocketAndUsage");
  assert.equal(fields[0].value, '"usageSummaryList": [\n{\n"quotaType": "NO-USE-NO-PAY",\n}\n]');
  assert.equal(fields[1].value, '"usageSummaryList": [\n{\n"quota": null,\n}\n],\n"creditLimit": null');
  assert.deepEqual(fields[0].highlights, [{ start: 24, end: 35, bold: true }]);
  assert.equal(isCodeSheetField(fields[0]), true);
});

test("presentation hides generated coordinate labels but keeps QA-authored headings", () => {
  assert.equal(sheetFieldDisplayLabel({ label: "ข้อมูลจาก F1", ref: "F1", value: "notes" }), "");
  assert.equal(sheetFieldDisplayLabel({ label: "Response", ref: "B7, B8", value: "{}" }), "Response");
  assert.equal(sheetFieldDisplayLabel({ label: "ข้อมูลจากลูกค้า", ref: "F1", value: "notes" }), "ข้อมูลจากลูกค้า");
});

test("parallel API responses split over rows are reconstructed per column, keeping headings and highlights", () => {
  const [section] = sheetSectionsFromCells([
    { ref: "B5", value: "Home page\n/core/api/v2/home/profile" },
    { ref: "C5", value: "Usage page\n/core/api/v2/usage/pocketAndUsage" },
    { ref: "A6", value: "Curl ::" }, { ref: "B6", value: "curl https://example.test/home" }, { ref: "C6", value: "curl https://example.test/usage" },
    { ref: "A7", value: "Response ::" }, { ref: "B7", value: "{" }, { ref: "C7", value: "{" },
    { ref: "B8", value: '"status": "S"' }, { ref: "C8", value: '"status": "F"' },
    { ref: "B9", value: "}" }, { ref: "C9", value: "}" },
  ]);
  section.rows.find(row => row.row === 8)!.fields[0].highlights = [{ start: 0, end: 8, background: "yellow" }];
  const fields = sectionFieldsForDisplay(section);
  assert.equal(fields.length, 4);
  assert.deepEqual(fields.map(field => field.value), ["curl https://example.test/home", '{\n"status": "S"\n}', "curl https://example.test/usage", '{\n"status": "F"\n}']);
  assert.ok(fields[1].label.includes("Home page"));
  assert.ok(fields[3].label.includes("Usage page"));
  assert.deepEqual(fields[1].highlights, [{ start: 2, end: 10, background: "yellow" }]);
  assert.equal(isCodeSheetField(fields[1]), true);
});

test("image anchors belong only to their spatial section and unknown images remain unassigned", () => {
  const groups = [{ startRow: 4 }, { startRow: 31 }, { startRow: 66 }];
  assert.equal(evidenceSectionIndex("178-sheet-RC_TC-01-4-0-image.webp", "RC  TC-01", groups), 0);
  assert.equal(evidenceSectionIndex("sheet-RC_TC-01-33-0-image.webp", "RC  TC-01", groups), 1);
  assert.equal(evidenceSectionIndex("sheet-RC_TC-01-69-0-image.webp", "RC  TC-01", groups), 2);
  assert.equal(evidenceSectionIndex("uploaded.webp", "RC  TC-01", groups), -1);
  assert.equal(evidenceSectionIndex("sheet-other-33-0-image.webp", "RC  TC-01", groups), -1);
});

test("spatial sections separate repeated endpoints and keep nearby headings with their payload", () => {
  const sections = sheetSectionsFromCells([
    { ref: "G4", value: "Endpoint: /same" }, { ref: "G5", value: "Alice - HTTP Inspector\nResponse status: 200" },
    { ref: "A31", value: "No records" },
    { ref: "D33", value: "Endpoint: /same" }, { ref: "D34", value: "Alice - HTTP Inspector\nResponse status: 200" },
    { ref: "A66", value: "Unexpected outcome" },
    { ref: "D70", value: "Endpoint: /same" }, { ref: "D71", value: "Alice - HTTP Inspector\nResponse status: 500" },
  ]);
  const groups = groupSheetResultSections(sections);
  assert.deepEqual(groups.map(group => group.sections.flatMap(section => section.rows.map(row => row.row))), [[4, 5], [31, 33, 34], [66, 70, 71]]);
  assert.deepEqual(groups.map(group => group.startRow), [4, 31, 66]);
});

test("ordinary sheet text uses prose while API, logs and JSON keep the code viewer", () => {
  assert.equal(isCodeSheetField({ ref: "A1", label: "Case", value: "Buy package success\nDtac staff" }), false);
  assert.equal(isCodeSheetField({ ref: "A2", label: "log1", value: "request completed" }), true);
  assert.equal(isCodeSheetField({ ref: "A3", label: "Endpoint: /package/api/v1", value: "response success" }), true);
  assert.equal(isCodeSheetField({ ref: "A4", label: "ข้อมูล", value: '{"status":"success"}' }), true);
  assert.equal(isCodeSheetField({ ref: "A5", label: "ข้อมูล", value: 'service_Debug.log:1:hello' }), true);
  assert.equal(isCodeSheetField({ ref: "F23", label: "ข้อมูลจาก F23", value: '{\n "status": {"code": 200}' }), true);
});

test("HTTP Inspector exports and mixed API logs use code even with generic cell labels", () => {
  for (const value of [
    'Alice - HTTP Inspector\nApp name: Example\nRequest body: {"id":1}\nResponse body: {"status":"ok"}\nCurl\ncurl -X POST https://example.test',
    'Endpoint: /package/category/api/v1/crossSellCheckout',
    'Request headers: {"content-type":"application/json"}\nResponse status: 200',
    'curl -X POST https://example.test --data "test"',
    "curl 'https://example.test/core' \\\n-H 'platform: ANDROID' \\\n--proxy http://localhost:9090",
    '"groupType": "OTHER",',
  ]) assert.equal(isCodeSheetField({ ref: "G5", label: "ข้อมูลจาก G5", value }), true);
  assert.equal(isCodeSheetField({ ref: "A31", label: "ข้อมูลจาก A31", value: "Case : Data not found" }), false);
  assert.equal(isCodeSheetField({ ref: "A1", label: "Notes", value: "Check the response and request again" }), false);
});

test("fixed name/value display keeps both table columns and resolves vertical labels", () => {
  const [table] = sheetSectionsFromCells([{ ref: "A1", value: "log1" }, { ref: "B1", value: "log2" }, { ref: "A2", value: "first" }, { ref: "B2", value: "second" }]);
  assert.deepEqual(sectionFieldsForDisplay(table).map(field => [field.label, field.value]), [["log1", "first"], ["log2", "second"]]);
  const [vertical] = sheetSectionsFromCells([{ ref: "A4", value: "Device" }, { ref: "B4", value: "Android" }]);
  assert.deepEqual(sectionFieldsForDisplay(vertical).map(field => [field.label, field.value, field.ref]), [["Device", "Android", "A4 / B4"]]);
});

test("fixed name/value display keeps continuous logs as one value with highlights", () => {
  const fields = sectionFieldsForDisplay({ id: "logs", title: "Logs", kind: "log", rows: [
    { row: 1, fields: [{ ref: "A1", label: "Log", value: "first" }] },
    { row: 2, fields: [{ ref: "A2", label: "Log", value: "second", highlights: [{ start: 0, end: 6, background: "yellow" }] }] },
  ] });
  assert.deepEqual(fields, [{ label: "Log", ref: "A1, A2", value: "first\nsecond", highlights: [{ start: 6, end: 12, background: "yellow" }] }]);
});

test("separates tables, rows, and log columns without merging repeated values", () => {
  const sections = sheetSectionsFromCells([
    { ref: "A1", value: "log1" }, { ref: "B1", value: "log2" },
    { ref: "A2", value: "same log" }, { ref: "B2", value: "same log" },
    { ref: "A3", value: "next log" },
    { ref: "D8", value: "Customer" }, { ref: "E8", value: "Test data" },
    { ref: "D9", value: "customer A" }, { ref: "E9", value: "value A" },
  ]);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].rows.length, 2);
  assert.deepEqual(sections[0].rows[0].fields.map(field => [field.ref, field.label, field.value]), [["A2", "log1", "same log"], ["B2", "log2", "same log"]]);
  assert.equal(sections[0].rows[1].fields[0].label, "log1");
  assert.equal(sections[1].rows[0].fields[1].label, "Test data");
  assert.deepEqual(sections[0].headers?.map(header => header.label), ["log1", "log2"]);
});

test("untitled and isolated cells retain coordinates and full text", () => {
  const text = "data\n".repeat(10000);
  const sections = sheetSectionsFromCells([{ ref: "ZZ300", value: text }]);
  assert.equal(sections[0].rows[0].fields[0].label, "ข้อมูลจาก ZZ300");
  assert.equal(sections[0].rows[0].fields[0].value, text);
});

test("one Log heading keeps Endpoint, Transaction and Debug together across blank rows", () => {
  const sections = sheetSectionsFromCells([
    { ref: "A1", value: "Log :" },
    { ref: "A3", value: 'service_Endpoint.log:55:{"txId":"TX-A","message":"first"}' },
    { ref: "A7", value: 'service_Transaction.log:7:{"txId":"TX-A"}' },
    { ref: "A9", value: 'service_Debug.log:8:2025-11-19T13:59:15|INFO |SESSION|TX-A|Authorization: Bearer test-token' },
  ]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].kind, "log");
  const groups = sectionLogGroups(sections[0]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].transactionId, "TX-A");
  assert.deepEqual(groups[0].fields.map(field => field.ref), ["A3", "A7", "A9"]);
  assert.ok(combineSheetFields(groups[0].fields).text.includes("Authorization: Bearer test-token"));
});

test("different transactions and unlabeled logs stay separate; parallel log columns stay a table", () => {
  const [section] = sheetSectionsFromCells([
    { ref: "A1", value: 'a.log:1:{"txId":"A"}' },
    { ref: "A2", value: 'a.log:2:{"txId":"B"}' },
    { ref: "A3", value: 'a.log:3:{"message":"unlinked"}' },
  ]);
  assert.deepEqual(sectionLogGroups(section).map(group => group.transactionId), ["A", "B", null]);
  const [table] = sheetSectionsFromCells([{ ref: "A1", value: "log1" }, { ref: "B1", value: "log2" }, { ref: "A2", value: 'a.log:1:{"txId":"A"}' }, { ref: "B2", value: 'a.log:1:{"txId":"A"}' }]);
  assert.equal(table.kind, "table");
});

test("combined log highlight positions include preceding text and newline", () => {
  assert.deepEqual(combineSheetFields([
    { ref: "A1", label: "Log", value: "first" },
    { ref: "A2", label: "Log", value: "second", highlights: [{ start: 0, end: 6, background: "yellow" }] },
  ]), { text: "first\nsecond", highlights: [{ start: 6, end: 12, background: "yellow" }] });
});

test("recognizes vertical label/value fields and never absorbs them into the previous log", () => {
  const sections = sheetSectionsFromCells([
    { ref: "A1", value: 'a.log:1:{"txId":"A"}' },
    { ref: "A4", value: "Device" }, { ref: "B4", value: "Android" },
    { ref: "A5", value: "Environment" }, { ref: "B5", value: "UAT" },
  ]);
  assert.deepEqual(sections.map(section => section.kind), ["log", "fields"]);
});

test("manual section joins are reversible presentation only, keeping every source cell", () => {
  const sections = sheetSectionsFromCells([{ ref: "A1", value: "first" }, { ref: "A4", value: "second" }]);
  const joined = sectionsForDisplay(sections, { modes: {}, joins: { [sections[1].id]: sections[0].id } });
  assert.equal(joined.length, 1);
  assert.deepEqual(joined[0].rows.flatMap(row => row.fields.map(field => field.ref)), ["A1", "A4"]);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].rows.length, 1);
  assert.equal(sectionsForDisplay(sections, { modes: {} }).length, 2);
});

test("nested response transaction IDs do not override the parent Debug transaction", () => {
  const [section] = sheetSectionsFromCells([
    { ref: "A1", value: 'service_Debug.log:1:2025-11-19T13:59:15|INFO |SESSION|PARENT|response={"transactionId":"CHILD"}' },
    { ref: "A2", value: 'service_Endpoint.log:2:{"txId":"PARENT","data":{"transactionId":"CHILD"}}' },
  ]);
  assert.deepEqual(sectionLogGroups(section).map(group => group.transactionId), ["PARENT"]);
});
