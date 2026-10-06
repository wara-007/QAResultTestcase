import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from "fflate";
import type { TestCase, TestStatus, WorkbookFreeformResult, WorkbookResultImage, WorkbookSheet, WorkbookSheetContent, WorkbookSheetKind, WorkbookSource } from "./types";
import { freeformTextFromCells } from "./sheet-detail";
import { parseStepTestCases } from "./step-testcases";
import { isProjectSummarySheet, testCaseIdsMatchingSheetName } from "./sheet-mapping-model";
import { parseStepSheetResults } from "./step-sheet-results";
import { parseCoverSnapshot } from "./workbook-validation";
import { buildStepSheetWritePlan, stepResultSnapshotRows } from "./step-sheet-sync";

const readOnlyWorkbooks = new WeakMap<ArrayBuffer, { files: Unzipped; strings: string[]; sheets: Map<string, WorkbookSheetContent> }>();
function readOnlyWorkbook(buffer: ArrayBuffer) {
  let cached = readOnlyWorkbooks.get(buffer);
  if (!cached) {
    const files = unzipSync(new Uint8Array(buffer));
    cached = { files, strings: readSharedStrings(files), sheets: new Map() };
    readOnlyWorkbooks.set(buffer, cached);
  }
  return cached;
}

const fieldAliases: Record<string, string[]> = {
  id: ["testcase id", "test case id", "case id"],
  platform: ["platform"],
  condition: ["condition"],
  scenario: ["test scenario", "scenario"],
  name: ["test case name", "testcase name", "case name"],
  steps: ["test step description", "test step", "steps"],
  expected: ["expected result", "expected"],
  status: ["test result", "status", "result"],
  device: ["device"],
  testData: ["data test", "test data"],
  appVersion: ["app version", "version"],
  environment: ["env", "environment"],
  resultReference: ["ref result testing", "result testing", "result reference"],
  executedBy: ["executed by", "tester"],
  executedDate: ["executed date", "test date"],
  executedTime: ["executed time", "test time"],
  remark: ["remark", "note", "notes"],
};

const defaultColumns: Record<string, string> = {
  id: "A",
  platform: "B",
  condition: "C",
  scenario: "D",
  name: "E",
  steps: "F",
  expected: "G",
  status: "H",
  device: "I",
  testData: "J",
  appVersion: "K",
  environment: "L",
  resultReference: "M",
  executedBy: "N",
  executedDate: "O",
  executedTime: "P",
  remark: "Q",
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/[\n\r*._()/-]+/g, " ").replace(/\s+/g, " ").trim();

const parseXml = (value: Uint8Array) => {
  const document = new DOMParser().parseFromString(strFromU8(value), "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("ไฟล์ Excel มี XML ที่อ่านไม่ได้");
  return document;
};

const columnFromRef = (ref: string) => ref.replace(/[0-9]/g, "");
const rowFromRef = (ref: string) => Number(ref.replace(/[^0-9]/g, ""));

function resolvePartPath(fromPath: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = [...fromPath.split("/").slice(0, -1), ...target.split("/")];
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

function relationshipId(element: Element) {
  return element.getAttribute("r:id") ?? element.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
}

function relatedPart(files: Unzipped, sourcePath: string, id: string | null) {
  if (!id) return "";
  const slash = sourcePath.lastIndexOf("/");
  const relationshipsPath = `${sourcePath.slice(0, slash)}/_rels/${sourcePath.slice(slash + 1)}.rels`;
  const relationshipsFile = files[relationshipsPath];
  if (!relationshipsFile) return "";
  const relationships = parseXml(relationshipsFile);
  const relationship = Array.from(relationships.getElementsByTagName("Relationship")).find((item) => item.getAttribute("Id") === id);
  return relationship ? resolvePartPath(sourcePath, relationship.getAttribute("Target") ?? "") : "";
}

function sheetKind(name: string): WorkbookSheetKind {
  const value = normalize(name);
  if (isProjectSummarySheet(name)) return "summary";
  if (value === "testcase" || value.includes("test case")) return "testcase";
  if (value.includes("summary")) return "summary";
  if (value.includes("defect")) return /def[\s_-]*\d+/i.test(name) || value.startsWith("rc") ? "result" : "defect";
  if (value === "data test" || value.includes("test data")) return "data";
  if (/\b(?:tc|def)[\s:_-]*\d+/i.test(name) || value.startsWith("rc")) return "result";
  return "other";
}

function idsFromSheetName(name: string) {
  return Array.from(name.matchAll(/\b(TC|DEF)[\s:_-]*(\d+)/gi), (match) => `${match[1].toUpperCase()}-${match[2].padStart(2, "0")}`)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function testCaseIdsFromSheetContent(files: Unzipped, sheetPath: string, sharedStrings: string[]) {
  const sheetFile = files[sheetPath];
  if (!sheetFile) return [];
  const document = parseXml(sheetFile);
  const values = Array.from(document.getElementsByTagName("c"))
    .slice(0, 300)
    .map((cell) => cellValue(cell, sharedStrings));
  return values.flatMap((value) => Array.from(
    value.matchAll(/\b(?:TC|TEST\s*CASE|TESTCASE|CASE)[\s:_-]*(\d+)\b/gi),
    (match) => `TC-${match[1].padStart(2, "0")}`,
  )).filter((value, index, all) => all.indexOf(value) === index);
}

function enrichResultSheets(files: Unzipped, sheets: WorkbookSheet[], sharedStrings: string[]) {
  return sheets.map((sheet) => {
    if (sheet.kind === "testcase") return sheet;
    const contentIds = testCaseIdsFromSheetContent(files, sheet.path, sharedStrings);
    const nameIds = idsFromSheetName(sheet.name).filter((id) => id.startsWith("TC-"));
    const testCaseIds = (nameIds.length ? nameIds : [...sheet.testCaseIds, ...contentIds])
      .filter((value, index, all) => all.indexOf(value) === index);
    const hasTestCase = testCaseIds.some((id) => id.startsWith("TC-"));
    return {
      ...sheet,
      testCaseIds,
      kind: sheet.kind === "other" && hasTestCase && sheet.imageCount > 0 ? "result" as const : sheet.kind,
    };
  });
}

function imageCountForSheet(files: Unzipped, sheetPath: string) {
  const sheetFile = files[sheetPath];
  if (!sheetFile) return 0;
  const sheetDocument = parseXml(sheetFile);
  const drawings = Array.from(sheetDocument.getElementsByTagName("drawing"));
  return drawings.reduce((total, drawing) => {
    const drawingPath = relatedPart(files, sheetPath, relationshipId(drawing));
    const drawingFile = files[drawingPath];
    return total + (drawingFile ? parseXml(drawingFile).getElementsByTagName("xdr:pic").length || parseXml(drawingFile).getElementsByTagName("pic").length : 0);
  }, 0);
}

function resolveSheets(files: Unzipped): WorkbookSheet[] {
  const workbook = parseXml(files["xl/workbook.xml"]);
  const sheets = Array.from(workbook.getElementsByTagName("sheet"));
  const relationships = parseXml(files["xl/_rels/workbook.xml.rels"]);
  const relationshipMap = new Map(Array.from(relationships.getElementsByTagName("Relationship")).map((item) => [item.getAttribute("Id"), item.getAttribute("Target") ?? ""]));
  return sheets.map((sheet, order) => {
    const name = sheet.getAttribute("name") ?? `Sheet ${order + 1}`;
    const target = relationshipMap.get(relationshipId(sheet)) ?? "";
    const path = resolvePartPath("xl/workbook.xml", target);
    return {
      name,
      path,
      order,
      kind: sheetKind(name),
      testCaseIds: idsFromSheetName(name),
      imageCount: imageCountForSheet(files, path),
      hidden: sheet.getAttribute("state") === "hidden" || sheet.getAttribute("state") === "veryHidden",
    };
  });
}

function readSharedStrings(files: Unzipped) {
  const file = files["xl/sharedStrings.xml"];
  if (!file) return [];
  const document = parseXml(file);
  return Array.from(document.getElementsByTagName("si")).map((item) => item.textContent ?? "");
}

function cellValue(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return cell.getElementsByTagName("is")[0]?.textContent ?? "";
  const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  return raw;
}

const asStatus = (value: string): TestStatus => {
  const normalized = normalize(value);
  if (normalized === "pass" || normalized === "passed") return "Pass";
  if (normalized === "fail" || normalized === "failed") return "Failed";
  if (normalized === "skip" || normalized === "skipped") return "Skip";
  if (normalized === "in progress") return "In Progress";
  return "Not Start";
};

const excelDate = (value: string) => {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 10_000) return value;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
};

export function importTestCases(buffer: ArrayBuffer, fileName: string) {
  const { files, strings: sharedStrings } = readOnlyWorkbook(buffer);
  const sheets = enrichResultSheets(files, resolveSheets(files), sharedStrings);
  const sheet = sheets.find((item) => normalize(item.name) === "testcase") ?? sheets.find((item) => normalize(item.name).includes("testcase"));
  if (!sheet) throw new Error("ไม่พบชีตชื่อ Testcase");
  const document = parseXml(files[sheet.path]);
  const cells = Array.from(document.getElementsByTagName("c"));
  const values = new Map(cells.map((cell) => [cell.getAttribute("r") ?? "", cellValue(cell, sharedStrings)]));
  const stepRows: string[][] = [];
  for (const [ref, value] of values) {
    const rowIndex = rowFromRef(ref) - 1;
    const columnIndex = [...columnFromRef(ref)].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
    if (rowIndex >= 0 && columnIndex >= 0) (stepRows[rowIndex] ??= [])[columnIndex] = value;
  }
  const stepCases = parseStepTestCases(Array.from({ length: stepRows.length }, (_, index) => stepRows[index] ?? []), sheet.name);
  if (stepCases) {
    sheets.forEach(item => { if (item.kind !== "summary" && item.kind !== "defect") item.testCaseIds = testCaseIdsMatchingSheetName(item.name, stepCases); });
    const source: WorkbookSource = { fileName, buffer, bufferLoaded: true, sheetName: sheet.name, sheetPath: sheet.path, columns: {}, sheets };
    const cover = sheets.find(item => item.kind === "summary");
    if (cover) source.coverSnapshot = parseCoverSnapshot(contentRows(readWorkbookSheet(source, cover)), cover.name);
    return { cases: stepCases, source };
  }

  const headerRows = Array.from(document.getElementsByTagName("row")).slice(0, 10);
  const detectedColumns: Record<string, string> = {};
  const detectedScores: Record<string, number> = {};
  let headerRow = 1;

  for (const row of headerRows) {
    const rowNumber = Number(row.getAttribute("r") ?? 0);
    for (const cell of Array.from(row.getElementsByTagName("c"))) {
      const ref = cell.getAttribute("r") ?? "";
      const header = normalize(cellValue(cell, sharedStrings));
      for (const [field, aliases] of Object.entries(fieldAliases)) {
        const score = aliases.reduce((best, alias) => header === alias ? 2 : header.includes(alias) ? Math.max(best, 1) : best, 0);
        if (score > (detectedScores[field] ?? 0)) {
          detectedColumns[field] = columnFromRef(ref);
          detectedScores[field] = score;
          if (field === "id") headerRow = rowNumber;
        }
      }
    }
  }

  const columns = { ...defaultColumns, ...detectedColumns };
  const maximumRow = Math.max(...cells.map((cell) => rowFromRef(cell.getAttribute("r") ?? "0")));
  const get = (field: string, row: number) => values.get(`${columns[field]}${row}`)?.trim() ?? "";
  const cases: TestCase[] = [];
  let previousScenario = "";
  let previousSteps = "";

  for (let row = headerRow + 1; row <= maximumRow; row += 1) {
    const id = get("id", row);
    if (!id || !/^(TC|TEST|CASE)[\s_-]*\d+/i.test(id)) continue;
    const scenario = get("scenario", row) || previousScenario;
    const steps = get("steps", row) || previousSteps;
    if (scenario) previousScenario = scenario;
    if (steps) previousSteps = steps;
    cases.push({
      id,
      sourceRow: row,
      platform: get("platform", row),
      condition: get("condition", row),
      scenario,
      name: get("name", row),
      steps,
      expected: get("expected", row),
      status: asStatus(get("status", row)),
      device: get("device", row),
      testData: get("testData", row),
      appVersion: get("appVersion", row),
      environment: get("environment", row),
      resultReference: get("resultReference", row),
      executedBy: get("executedBy", row),
      executedDate: excelDate(get("executedDate", row)),
      executedTime: get("executedTime", row),
      remark: get("remark", row),
      evidence: [],
    });
  }

  if (!cases.length) throw new Error("ไม่พบ Testcase ID ในชีต Testcase");
  const source: WorkbookSource = { fileName, buffer, bufferLoaded: true, sheetName: sheet.name, sheetPath: sheet.path, columns, sheets };
  return { cases, source };
}

const mimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

function elementsByLocalName(parent: Document | Element, name: string) {
  return Array.from(parent.getElementsByTagName("*")).filter((element) => element.localName === name);
}

function drawingImages(files: Unzipped, sheetPath: string) {
  const sheetFile = files[sheetPath];
  if (!sheetFile) return [];
  const sheetDocument = parseXml(sheetFile);
  const placements: WorkbookSheetContent["images"] = [];
  for (const drawing of Array.from(sheetDocument.getElementsByTagName("drawing"))) {
    const drawingPath = relatedPart(files, sheetPath, relationshipId(drawing));
    const drawingFile = files[drawingPath];
    if (!drawingFile) continue;
    const drawingDocument = parseXml(drawingFile);
    const anchors = elementsByLocalName(drawingDocument, "twoCellAnchor").concat(elementsByLocalName(drawingDocument, "oneCellAnchor"));
    for (const anchor of anchors) {
      const from = elementsByLocalName(anchor, "from")[0];
      const blip = elementsByLocalName(anchor, "blip")[0];
      if (!from || !blip) continue;
      const embedId = blip.getAttribute("r:embed") ?? blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
      const imagePath = relatedPart(files, drawingPath, embedId);
      const bytes = files[imagePath];
      if (!bytes) continue;
      const name = imagePath.split("/").pop() ?? "evidence";
      const extension = name.split(".").pop()?.toLowerCase() ?? "";
      const row = Number(elementsByLocalName(from, "row")[0]?.textContent ?? 0) + 1;
      const column = Number(elementsByLocalName(from, "col")[0]?.textContent ?? 0);
      placements.push({ name, mimeType: mimeTypes[extension] ?? "application/octet-stream", bytes, row, column });
    }
  }
  return placements;
}

export function readWorkbookSheet(source: WorkbookSource, sheet: WorkbookSheet): WorkbookSheetContent {
  const cached = readOnlyWorkbook(source.buffer);
  const existing = cached.sheets.get(sheet.path);
  if (existing) return existing;
  const { files, strings: sharedStrings } = cached;
  const document = parseXml(files[sheet.path]);
  const allCells = Array.from(document.getElementsByTagName("c"))
    .map((cell) => ({ ref: cell.getAttribute("r") ?? "", value: cellValue(cell, sharedStrings).trim() }))
    .filter((cell) => cell.value);
  const cells = allCells;

  const images = drawingImages(files, sheet.path);
  const content = { cells, truncatedCellCount: Math.max(0, allCells.length - cells.length), images };
  cached.sheets.set(sheet.path, content);
  return content;
}

export function readWorkbookResultImages(source: WorkbookSource, cases: TestCase[] = []): WorkbookResultImage[] {
  const { files, strings: sharedStrings } = readOnlyWorkbook(source.buffer);
  const imported: WorkbookResultImage[] = [];
  for (const sheet of source.sheets.filter((item) => item.kind !== "testcase" && item.kind !== "summary" && item.kind !== "defect")) {
    const ownerCase = cases.find(item => sheet.testCaseIds.includes(item.id) || item.id === sheet.name);
    if (ownerCase?.stepDefinitions?.length) {
      const content = readWorkbookSheet(source, sheet);
      const parsed = parseStepSheetResults(contentRows(content), ownerCase, sheet.name)!;
      content.images.forEach(image => {
        const result = parsed.results.find(result => result.sourceRange && image.row >= result.sourceRange.startRow && image.row <= result.sourceRange.endRow);
        imported.push({ ...image, sheetName: sheet.name, testCaseId: ownerCase.id, resultId: result?.id ?? `SHEET-IMPORT-${sheet.name}-UNASSIGNED` });
      });
      continue;
    }
    const document = parseXml(files[sheet.path]);
    const rows = Array.from(document.getElementsByTagName("row"));
    let headerRow = -1;
    let resultIdColumn = "";
    let defectHeaderRow = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const rowNumber = Number(row.getAttribute("r") ?? 0);
      for (const cell of Array.from(row.getElementsByTagName("c"))) {
        const value = normalize(cellValue(cell, sharedStrings));
        if (value === "result id" && headerRow < 0) {
          headerRow = rowNumber;
          resultIdColumn = columnFromRef(cell.getAttribute("r") ?? "");
        }
        if (value === "defect id") defectHeaderRow = Math.min(defectHeaderRow, rowNumber);
      }
    }
    const testCaseId = sheet.testCaseIds.find((id) => id.startsWith("TC-")) ?? sheet.name;
    if (headerRow < 0 || !resultIdColumn) {
      const fallbackResultId = `SHEET-IMPORT-${sheet.name}`;
      drawingImages(files, sheet.path).forEach((image) => {
        imported.push({ ...image, sheetName: sheet.name, testCaseId, resultId: fallbackResultId });
      });
      continue;
    }
    const resultRows = rows.flatMap((row) => {
      const rowNumber = Number(row.getAttribute("r") ?? 0);
      if (rowNumber <= headerRow || rowNumber >= defectHeaderRow) return [];
      const idCell = Array.from(row.getElementsByTagName("c")).find((cell) => columnFromRef(cell.getAttribute("r") ?? "") === resultIdColumn);
      const resultId = idCell ? cellValue(idCell, sharedStrings).trim() : "";
      return resultId ? [{ row: rowNumber, resultId }] : [];
    });
    if (!resultRows.length) continue;
    for (const image of drawingImages(files, sheet.path)) {
      const owner = resultRows.filter((result) => result.row <= image.row).at(-1);
      if (!owner || image.row >= defectHeaderRow) continue;
      imported.push({ ...image, sheetName: sheet.name, testCaseId, resultId: owner.resultId });
    }
  }
  return imported;
}

function contentRows(content: WorkbookSheetContent) {
  const rows: string[][] = [];
  for (const cell of content.cells) {
    const row = rowFromRef(cell.ref) - 1;
    const column = [...columnFromRef(cell.ref)].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
    (rows[row] ??= [])[column] = cell.value;
  }
  return Array.from({ length: rows.length }, (_, index) => rows[index] ?? []);
}

export function readWorkbookFreeformResults(source: WorkbookSource, cases: TestCase[] = []): WorkbookFreeformResult[] {
  const { files, strings: sharedStrings } = readOnlyWorkbook(source.buffer);
  const results: WorkbookFreeformResult[] = [];

  for (const sheet of source.sheets.filter((item) => item.kind !== "testcase" && item.kind !== "summary" && item.kind !== "defect")) {
    const ownerCase = cases.find(item => sheet.testCaseIds.includes(item.id) || item.id === sheet.name);
    if (ownerCase?.stepDefinitions?.length) {
      const parsed = parseStepSheetResults(contentRows(readWorkbookSheet(source, sheet)), ownerCase, sheet.name)!;
      results.push(...parsed.results.map(result => ({ ...result, sheetName: sheet.name, testCaseId: ownerCase.id, resultId: result.id })));
      continue;
    }
    const document = parseXml(files[sheet.path]);
    const allCells = Array.from(document.getElementsByTagName("c")).map((cell) => ({
      ref: cell.getAttribute("r") ?? "",
      row: rowFromRef(cell.getAttribute("r") ?? "0"),
      column: columnFromRef(cell.getAttribute("r") ?? ""),
      value: cellValue(cell, sharedStrings).trim(),
    })).filter((cell) => cell.value);
    if (allCells.some((cell) => normalize(cell.value) === "result id")) continue;

    const testCaseId = sheet.testCaseIds.find((id) => id.startsWith("TC-")) ?? sheet.name;
    const text = freeformTextFromCells(allCells);
    const images = drawingImages(files, sheet.path);
    if (!text.actualResult && !text.apiResponse && !text.log && !images.length) continue;
    results.push({
      sheetName: sheet.name,
      testCaseId,
      resultId: `SHEET-IMPORT-${sheet.name}`,
      ...text,
      actualResult: text.actualResult || `นำเข้าจาก Google Sheets · ${sheet.name}`,
    });
  }
  return results;
}

function setInlineString(document: Document, ref: string, value: string) {
  const namespace = document.documentElement.namespaceURI;
  const sheetData = document.getElementsByTagName("sheetData")[0];
  const rowNumber = rowFromRef(ref);
  let row = Array.from(document.getElementsByTagName("row")).find((item) => Number(item.getAttribute("r")) === rowNumber);
  if (!row) {
    row = document.createElementNS(namespace, "row");
    row.setAttribute("r", String(rowNumber));
    sheetData.appendChild(row);
  }

  let cell = Array.from(row.getElementsByTagName("c")).find((item) => item.getAttribute("r") === ref);
  if (!cell) {
    cell = document.createElementNS(namespace, "c");
    cell.setAttribute("r", ref);
    row.appendChild(cell);
  }
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.setAttribute("t", "inlineStr");
  const inline = document.createElementNS(namespace, "is");
  const text = document.createElementNS(namespace, "t");
  if (/^\s|\s$|\n/.test(value)) text.setAttribute("xml:space", "preserve");
  text.textContent = value;
  inline.appendChild(text);
  cell.appendChild(inline);
}

export function exportTestCases(source: WorkbookSource, cases: TestCase[]) {
  const files = unzipSync(new Uint8Array(source.buffer));
  const document = parseXml(files[source.sheetPath]);
  const stepCases = cases.filter(testCase => testCase.stepDefinitions?.length);
  if (stepCases.length) {
    const rows = contentRows(readWorkbookSheet(source, source.sheets.find(sheet => sheet.path === source.sheetPath)!));
    const formulaRefs = new Set(Array.from(document.getElementsByTagName("c")).filter(cell => cell.getElementsByTagName("f").length).map(cell => cell.getAttribute("r")));
    for (const write of buildStepSheetWritePlan(stepCases, rows)) {
      const ref = write.range.split("!")[1];
      if (!formulaRefs.has(ref)) setInlineString(document, ref, String(write.values[0][0] ?? ""));
    }
    files[source.sheetPath] = strToU8(new XMLSerializer().serializeToString(document));
    for (const testCase of stepCases) {
      const target = source.sheets.find(sheet => sheet.name === testCase.id);
      if (!target) throw new Error(`ไม่พบแท็บรายละเอียด ${testCase.id} สำหรับดาวน์โหลดแบบปลอดภัย`);
      const detail = parseXml(files[target.path]);
      const content = readWorkbookSheet(source, target);
      const lastRow = Math.max(0, ...content.cells.map(cell => rowFromRef(cell.ref)), ...content.images.map(image => image.row + 100));
      const values = stepResultSnapshotRows(testCase);
      values.forEach((row, index) => row.forEach((value, column) => setInlineString(detail, `${String.fromCharCode(65 + column)}${lastRow + index + 2}`, value)));
      files[target.path] = strToU8(new XMLSerializer().serializeToString(detail));
    }
    return zipSync(files, { level: 6 });
  }
  const exportFields: Array<keyof TestCase> = [
    "status",
    "device",
    "testData",
    "appVersion",
    "environment",
    "resultReference",
    "executedBy",
    "executedDate",
    "executedTime",
    "remark",
  ];

  for (const testCase of cases) {
    for (const field of exportFields) {
      setInlineString(document, `${source.columns[field]}${testCase.sourceRow}`, String(testCase[field] ?? ""));
    }
  }

  files[source.sheetPath] = strToU8(new XMLSerializer().serializeToString(document));
  const workbookDocument = parseXml(files["xl/workbook.xml"]);
  const calculation = workbookDocument.getElementsByTagName("calcPr")[0];
  if (calculation) {
    calculation.setAttribute("calcMode", "auto");
    calculation.setAttribute("fullCalcOnLoad", "1");
    calculation.setAttribute("forceFullCalc", "1");
    files["xl/workbook.xml"] = strToU8(new XMLSerializer().serializeToString(workbookDocument));
  }
  return zipSync(files, { level: 6 });
}
