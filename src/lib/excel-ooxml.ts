import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from "fflate";
import type { TestCase, TestStatus, WorkbookSheet, WorkbookSheetContent, WorkbookSheetKind, WorkbookSource } from "./types";

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
  const files = unzipSync(new Uint8Array(buffer));
  const sheets = resolveSheets(files);
  const sheet = sheets.find((item) => normalize(item.name) === "testcase") ?? sheets.find((item) => normalize(item.name).includes("testcase"));
  if (!sheet) throw new Error("ไม่พบชีตชื่อ Testcase");
  const sharedStrings = readSharedStrings(files);
  const document = parseXml(files[sheet.path]);
  const cells = Array.from(document.getElementsByTagName("c"));
  const values = new Map(cells.map((cell) => [cell.getAttribute("r") ?? "", cellValue(cell, sharedStrings)]));

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

  for (let row = headerRow + 1; row <= maximumRow; row += 1) {
    const id = get("id", row);
    if (!id || !/^(TC|TEST|CASE)[\s_-]*\d+/i.test(id)) continue;
    cases.push({
      id,
      sourceRow: row,
      platform: get("platform", row),
      condition: get("condition", row),
      scenario: get("scenario", row),
      name: get("name", row),
      steps: get("steps", row),
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
  const source: WorkbookSource = { fileName, buffer, sheetName: sheet.name, sheetPath: sheet.path, columns, sheets };
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

export function readWorkbookSheet(source: WorkbookSource, sheet: WorkbookSheet): WorkbookSheetContent {
  const files = unzipSync(new Uint8Array(source.buffer));
  const sharedStrings = readSharedStrings(files);
  const document = parseXml(files[sheet.path]);
  const allCells = Array.from(document.getElementsByTagName("c"))
    .map((cell) => ({ ref: cell.getAttribute("r") ?? "", value: cellValue(cell, sharedStrings).trim() }))
    .filter((cell) => cell.value);
  const cells = allCells.slice(0, 200).map((cell) => ({ ...cell, value: cell.value.length > 2_000 ? `${cell.value.slice(0, 2_000)}…` : cell.value }));

  const imagePaths = new Set<string>();
  for (const drawing of Array.from(document.getElementsByTagName("drawing"))) {
    const drawingPath = relatedPart(files, sheet.path, relationshipId(drawing));
    const drawingFile = files[drawingPath];
    if (!drawingFile) continue;
    const drawingDocument = parseXml(drawingFile);
    for (const blip of Array.from(drawingDocument.getElementsByTagName("a:blip"))) {
      const imagePath = relatedPart(files, drawingPath, blip.getAttribute("r:embed") ?? blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed"));
      if (imagePath) imagePaths.add(imagePath);
    }
  }
  const images = Array.from(imagePaths).flatMap((path) => {
    const bytes = files[path];
    if (!bytes) return [];
    const name = path.split("/").pop() ?? "evidence";
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    return [{ name, mimeType: mimeTypes[extension] ?? "application/octet-stream", bytes }];
  });
  return { cells, truncatedCellCount: Math.max(0, allCells.length - cells.length), images };
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
