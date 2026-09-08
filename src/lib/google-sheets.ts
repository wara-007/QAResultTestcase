import "server-only";

import { google } from "googleapis";
import type { googleOAuthClient } from "@/lib/google-user-oauth";
import type { TestCase, TestDefect, TestEvidence, TestResult, TestStatus, WorkbookSheet } from "@/lib/types";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];

type GoogleApiAuth = ReturnType<typeof getGoogleServiceAuth> | ReturnType<typeof googleOAuthClient>;

export function extractGoogleSheetId(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(trimmed) ? trimmed : "";
}

export function getGoogleServiceAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_EMAIL และ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  return new google.auth.JWT({ email, key, scopes: GOOGLE_SCOPES });
}

const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[\n\r*._()/-]+/g, " ").replace(/\s+/g, " ").trim();

const statusFromValue = (value: unknown): TestStatus => {
  const status = normalize(value);
  if (status === "pass" || status === "passed") return "Pass";
  if (status === "fail" || status === "failed") return "Failed";
  if (status === "skip" || status === "skipped") return "Skip";
  if (status === "in progress") return "In Progress";
  return "Not Start";
};

const evidenceFromValue = (value: unknown): TestEvidence[] => {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TestEvidence => Boolean(
      item && typeof item.fileId === "string" && typeof item.name === "string" && typeof item.mimeType === "string",
    ));
  } catch {
    return [];
  }
};

const sheetIds = (name: string) => Array.from(name.matchAll(/\b(TC|DEF)[\s:_-]*(\d+)/gi), (match) => `${match[1].toUpperCase()}-${match[2].padStart(2, "0")}`)
  .filter((value, index, values) => values.indexOf(value) === index);

const sheetKind = (name: string): WorkbookSheet["kind"] => {
  const value = normalize(name);
  if (value === "testcase" || value.includes("test case")) return "testcase";
  if (value.includes("summary")) return "summary";
  if (value.includes("defect")) return /def[\s:_-]*\d+/i.test(name) || value.startsWith("rc") ? "result" : "defect";
  if (value === "data test" || value.includes("test data")) return "data";
  if (/\b(?:tc|def)[\s:_-]*\d+/i.test(name) || value.startsWith("rc")) return "result";
  return "other";
};

function casesFromRows(rows: unknown[][]): TestCase[] {
  const aliases: Record<string, string[]> = {
    id: ["testcase id", "test case id", "case id"], platform: ["platform"], condition: ["condition"], scenario: ["test scenario", "scenario"],
    name: ["test case name", "testcase name", "case name"], steps: ["test step description", "test step", "steps"], expected: ["expected result", "expected"],
    status: ["test result", "status", "result"], device: ["device"], testData: ["data test", "test data"], appVersion: ["app version", "version"],
    environment: ["env", "environment"], resultReference: ["ref result testing", "result testing", "result reference"], executedBy: ["executed by", "tester"],
    executedDate: ["executed date", "test date"], executedTime: ["executed time", "test time"], remark: ["remark", "note", "notes"],
    evidence: ["evidence", "evidence images", "attachments"],
  };
  let headerIndex = rows.findIndex((row) => row.some((cell) => ["testcase id", "test case id"].includes(normalize(cell))));
  if (headerIndex < 0) headerIndex = 0;
  const header = rows[headerIndex] ?? [];
  const indexes: Record<string, number> = {};
  for (const [field, names] of Object.entries(aliases)) {
    const exact = header.findIndex((cell) => names.includes(normalize(cell)));
    indexes[field] = exact >= 0 ? exact : header.findIndex((cell) => names.some((name) => normalize(cell).includes(name)));
  }
  const get = (row: unknown[], field: string) => indexes[field] >= 0 ? String(row[indexes[field]] ?? "").trim() : "";
  return rows.slice(headerIndex + 1).flatMap((row, offset) => {
    const id = get(row, "id");
    if (!/^(TC|TEST|CASE)[\s_-]*\d+/i.test(id)) return [];
    return [{
      id, sourceRow: headerIndex + offset + 2, platform: get(row, "platform"), condition: get(row, "condition"), scenario: get(row, "scenario"),
      name: get(row, "name"), steps: get(row, "steps"), expected: get(row, "expected"), status: statusFromValue(get(row, "status")), device: get(row, "device"),
      testData: get(row, "testData"), appVersion: get(row, "appVersion"), environment: get(row, "environment"), resultReference: get(row, "resultReference"),
      executedBy: get(row, "executedBy"), executedDate: get(row, "executedDate"), executedTime: get(row, "executedTime"), remark: get(row, "remark"),
      evidence: evidenceFromValue(get(row, "evidence")),
    }];
  });
}

export async function appendGoogleSheetEvidence(spreadsheetId: string, sourceRow: number, evidence: TestEvidence[], auth: GoogleApiAuth = getGoogleServiceAuth()) {
  if (!Number.isInteger(sourceRow) || sourceRow < 2) throw new Error("ไม่พบแถวของ Testcase ใน Google Sheets");
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: "Testcase!R1", values: [["Evidence"]] },
        { range: `Testcase!R${sourceRow}`, values: [[JSON.stringify(evidence)]] },
      ],
    },
  });
}

export async function readGoogleSheet(spreadsheetId: string, auth: GoogleApiAuth = getGoogleServiceAuth()) {
  const sheets = google.sheets({ version: "v4", auth });
  const [metadata, values] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId, includeGridData: false, fields: "properties(title),sheets(properties(sheetId,title,index,hidden))" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Testcase!A:R", valueRenderOption: "FORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" }),
  ]);
  const workbookSheets: WorkbookSheet[] = (metadata.data.sheets ?? []).map((sheet, order) => {
    const name = sheet.properties?.title ?? `Sheet ${order + 1}`;
    return { name, path: String(sheet.properties?.sheetId ?? order), order: sheet.properties?.index ?? order, kind: sheetKind(name), testCaseIds: sheetIds(name), imageCount: 0, hidden: sheet.properties?.hidden ?? false };
  });
  const cases = casesFromRows(values.data.values ?? []);
  const resultSheetNames = new Set(workbookSheets.map((sheet) => sheet.name).filter((name) => cases.some((testCase) => testCase.id === name)));
  if (resultSheetNames.size) {
    const ranges = [...resultSheetNames].map((name) => `'${name.replaceAll("'", "''")}'!A:J`);
    const resultValues = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges, valueRenderOption: "FORMULA" });
    ranges.forEach((_range, index) => {
      const testCase = cases.find((item) => item.id === [...resultSheetNames][index]);
      if (testCase) {
        const rows = resultValues.data.valueRanges?.[index]?.values ?? [];
        const parsedResults = resultsFromRows(rows);
        testCase.results = parsedResults.map((result) => ({ ...result, defects: undefined }));
        testCase.defects = [...defectsFromRows(rows), ...parsedResults.flatMap((result) => result.defects ?? [])];
      }
    });
  }
  return { title: metadata.data.properties?.title ?? "Google Sheet", cases, sheets: workbookSheets };
}

function resultsFromRows(rows: unknown[][]): TestResult[] {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell) === "result id"));
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const indexOf = (names: string[], fallback: number) => {
    const index = header.findIndex((cell) => names.includes(normalize(cell)));
    return index >= 0 ? index : fallback;
  };
  const indexes = {
    id: indexOf(["result id"], 0), status: indexOf(["status"], 1), actual: indexOf(["actual result"], 2),
    api: indexOf(["api response"], 3), log: indexOf(["log"], 4), evidence: indexOf(["evidence", "รูปหลักฐาน"], 5),
    defect: indexOf(["defect"], 6), defectStatus: indexOf(["defect status"], 6), jira: indexOf(["jira url"], 7),
    createdAt: indexOf(["created at"], 8),
  };
  const defectHeaderIndex = rows.findIndex((row) => row.some((cell) => normalize(cell) === "defect id"));
  const dataRows = (headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows).slice(0, defectHeaderIndex >= 0 ? defectHeaderIndex - headerIndex - 1 : undefined);
  const logicalRows: unknown[][] = [];
  for (const row of dataRows) {
    const id = String(row[indexes.id] ?? "").trim();
    if (id) {
      logicalRows.push([...row]);
      continue;
    }
    const previous = logicalRows.at(-1);
    if (!previous || !row.some((cell) => String(cell ?? "").length)) continue;
    for (let column = 0; column < row.length; column += 1) {
      if (column === indexes.id || column === indexes.status) continue;
      previous[column] = `${String(previous[column] ?? "")}${String(row[column] ?? "")}`;
    }
  }
  return logicalRows.flatMap((row, index) => {
    const id = String(row[indexes.id] ?? "").trim();
    if (!id) return [];
    const evidence = String(row[indexes.evidence] ?? "").split(/\n+/).flatMap((url, evidenceIndex) => {
      const fileId = new URLSearchParams(url.split("?")[1] ?? "").get("id");
      return fileId ? [{ fileId, name: `Evidence ${evidenceIndex + 1}`, mimeType: "image/*" }] : [];
    });
    const defectLabels = String(row[indexes.defect] ?? "").split(/\n+/).filter(Boolean);
    const defectStatuses = String(row[indexes.defectStatus] ?? "").split(/\n+/).filter(Boolean);
    const jiraUrls = String(row[indexes.jira] ?? "").split(/\n+/).filter(Boolean);
    return [{
      id,
      status: statusFromValue(row[indexes.status]),
      actualResult: String(row[indexes.actual] ?? ""),
      apiResponse: String(row[indexes.api] ?? ""),
      log: String(row[indexes.log] ?? ""),
      evidence,
      defects: defectLabels.map((label, defectIndex) => {
        const [legacyStatus, ...legacyTitle] = label.split(":");
        const hasSeparateStatus = indexes.defectStatus !== indexes.defect;
        return { id: `${id}-defect-${defectIndex + 1}`, status: hasSeparateStatus ? (defectStatuses[defectIndex] ?? "Open") : (legacyStatus.trim() || "Open"), title: hasSeparateStatus ? label : (legacyTitle.join(":").trim() || label), description: "", jiraUrl: jiraUrls[defectIndex] ?? "", apiResponse: "", log: "", evidence: [], createdAt: String(row[indexes.createdAt] ?? "") || new Date(0 + index).toISOString() };
      }),
      createdAt: String(row[indexes.createdAt] ?? "") || new Date(0 + index).toISOString(),
    }];
  });
}

function defectsFromRows(rows: unknown[][]): TestDefect[] {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell) === "defect id"));
  if (headerIndex < 0) return [];
  const logicalRows: unknown[][] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (String(row[0] ?? "").trim()) logicalRows.push([...row]);
    else {
      const previous = logicalRows.at(-1);
      if (!previous) continue;
      for (let column = 3; column < row.length; column += 1) previous[column] = `${String(previous[column] ?? "")}\n${String(row[column] ?? "")}`.trim();
    }
  }
  return logicalRows.flatMap((row, index) => {
    const id = String(row[0] ?? "").trim();
    if (!id) return [];
    const evidence = String(row[6] ?? "").split(/\n+/).flatMap((url, evidenceIndex) => {
      const fileId = new URLSearchParams(url.split("?")[1] ?? "").get("id");
      return fileId ? [{ fileId, name: `Defect evidence ${evidenceIndex + 1}`, mimeType: "image/*" }] : [];
    });
    return [{ id, status: String(row[1] ?? "Open"), title: String(row[2] ?? "Defect"), description: String(row[3] ?? ""), apiResponse: String(row[4] ?? ""), log: String(row[5] ?? ""), evidence, jiraUrl: String(row[7] ?? ""), createdAt: String(row[8] ?? "") || new Date(index).toISOString() }];
  });
}

export async function exportGoogleSheetWorkbook(spreadsheetId: string, auth: GoogleApiAuth = getGoogleServiceAuth()) {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("ขอ access token สำหรับ Google Sheets ไม่สำเร็จ");
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?format=xlsx`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`ดาวน์โหลด workbook จาก Google Sheets ไม่สำเร็จ (${response.status})`);
  return response.arrayBuffer();
}

export async function writeGoogleSheetResults(spreadsheetId: string, cases: TestCase[], auth: GoogleApiAuth = getGoogleServiceAuth()) {
  const sheets = google.sheets({ version: "v4", auth });
  const formulaText = (value: string) => value.replaceAll('"', '""');
  const mainSheetData = [{
    range: "Testcase!A1:E1",
    values: [["Test Case Id", "Test Scenario*", "Test Case Name", "Test Step Description *", "Expected Result *"]],
  }, ...cases.filter((testCase) => testCase.sourceRow > 0).flatMap((testCase) => [
    {
      range: `Testcase!A${testCase.sourceRow}:E${testCase.sourceRow}`,
      values: [[testCase.id, testCase.scenario, testCase.name, testCase.steps, testCase.expected]],
    },
    {
      range: `Testcase!H${testCase.sourceRow}:Q${testCase.sourceRow}`,
      values: [[testCase.status, testCase.device, testCase.testData, testCase.appVersion, testCase.environment, testCase.resultReference, testCase.executedBy, testCase.executedDate, testCase.executedTime, testCase.remark]],
    },
  ])];
  if (!mainSheetData.length) throw new Error("ไม่มี Testcase สำหรับซิงค์");

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title))" });
  const existing = new Map((metadata.data.sheets ?? []).map((sheet) => [sheet.properties?.title ?? "", sheet.properties?.sheetId]));
  const resultCases = cases.filter((testCase) => (testCase.results?.length ?? 0) > 0 || (testCase.defects?.length ?? 0) > 0);
  const defectRecords = cases.flatMap((testCase) => (testCase.defects ?? []).map((defect) => ({ testCase, defect }))).map((record, index) => ({ ...record, displayId: `DEF-${String(index + 1).padStart(2, "0")}` }));
  const defectDisplayIds = new Map(defectRecords.map((record) => [record.defect.id, record.displayId]));
  const evidenceIds = [...new Set(resultCases.flatMap((testCase) => [
    ...(testCase.results ?? []).flatMap((result) => result.evidence),
    ...(testCase.defects ?? []).flatMap((defect) => defect.evidence),
  ]).map((evidence) => evidence.fileId))];
  if (evidenceIds.length) {
    const drive = google.drive({ version: "v3", auth });
    await Promise.all(evidenceIds.map(async (fileId) => {
      const permissions = await drive.permissions.list({ fileId, fields: "permissions(id,type,role)" });
      if (!permissions.data.permissions?.some((permission) => permission.type === "anyone" && permission.role === "reader")) {
        await drive.permissions.create({ fileId, requestBody: { type: "anyone", role: "reader" } });
      }
    }));
  }
  const addRequests = [
    ...resultCases.filter((testCase) => !existing.has(testCase.id)).map((testCase) => ({ addSheet: { properties: { title: testCase.id } } })),
    ...(defectRecords.length > 0 && !existing.has("Defected") ? [{ addSheet: { properties: { title: "Defected" } } }] : []),
  ];
  if (addRequests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: addRequests } });

  const refreshed = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title))" });
  const sheetIds = new Map((refreshed.data.sheets ?? []).map((sheet) => [sheet.properties?.title ?? "", sheet.properties?.sheetId]));
  const resultSheetData = resultCases.map((testCase) => {
    const values = resultSheetValues(testCase, defectDisplayIds);
    return { range: `'${testCase.id.replaceAll("'", "''")}'!A1:J${values.length}`, values };
  });
  const testcaseSheetId = sheetIds.get("Testcase");
  const defectedValues = [["Defected Id", "Platform", "App version", "Defected Description", "Jira Card", "Status", "Reporter", "Report Date", "Ref\n(Testcase)", "Ref\n(RC)", ""]];
  for (const record of defectRecords) {
    const detailValues = resultSheetData.find((item) => item.range.startsWith(`'${record.testCase.id.replaceAll("'", "''")}'!`))?.values ?? [];
    const detailRow = detailValues.findIndex((row) => String(row[0] ?? "") === record.displayId) + 1;
    const detailSheetId = sheetIds.get(record.testCase.id);
    const detailLink = detailSheetId != null && detailRow > 0 ? `#gid=${detailSheetId}&range=A${detailRow}` : "";
    const testcaseLink = testcaseSheetId != null && record.testCase.sourceRow > 0 ? `#gid=${testcaseSheetId}&range=A${record.testCase.sourceRow}` : "";
    const jiraLabel = record.defect.jiraUrl.split("/").filter(Boolean).at(-1) || "เปิด Jira";
    const reportDate = Number.isNaN(Date.parse(record.defect.createdAt)) ? "" : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok" }).format(new Date(record.defect.createdAt));
    defectedValues.push([
      detailLink ? `=HYPERLINK("${detailLink}","${record.displayId}")` : record.displayId,
      record.testCase.platform,
      record.testCase.appVersion,
      [record.defect.title, record.defect.description].filter(Boolean).join("\n"),
      record.defect.jiraUrl ? `=HYPERLINK("${formulaText(record.defect.jiraUrl)}","${formulaText(jiraLabel)}")` : "",
      record.defect.status,
      record.testCase.executedBy,
      reportDate,
      testcaseLink ? `=HYPERLINK("${testcaseLink}","${formulaText(record.testCase.id)}")` : record.testCase.id,
      detailLink ? `=HYPERLINK("${detailLink}","RC : ${record.displayId}")` : `RC : ${record.displayId}`,
      "",
    ]);
  }
  const defectedSheetData = defectRecords.length > 0 || existing.has("Defected") ? [{ range: `Defected!A1:K${defectedValues.length}`, values: defectedValues }] : [];
  if (resultSheetData.length) {
    await sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: resultCases.map((testCase) => `'${testCase.id.replaceAll("'", "''")}'!A:J`) } });
  }
  if (defectedSheetData.length) await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Defected!A:K" });
  const result = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: [...mainSheetData, ...resultSheetData, ...defectedSheetData] },
  });
  if (resultCases.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: resultCases.flatMap((testCase) => {
      const sheetId = sheetIds.get(testCase.id);
      if (sheetId == null) return [];
      return [
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 4 } }, fields: "gridProperties.frozenRowCount" } },
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.12, green: 0.29, blue: 0.57 }, horizontalAlignment: "CENTER", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
        { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.12, green: 0.29, blue: 0.57 }, horizontalAlignment: "CENTER", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
        { repeatCell: { range: { sheetId, startRowIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(verticalAlignment,wrapStrategy)" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 10 }, properties: { pixelSize: 190 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 4, endIndex: resultSheetData.find((item) => item.range.startsWith(`'${testCase.id.replaceAll("'", "''")}'!`))?.values.length ?? 5 }, properties: { pixelSize: 160 }, fields: "pixelSize" } },
      ];
    }) } });
  }
  const defectedSheetId = sheetIds.get("Defected");
  if (defectedSheetId != null) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { updateSheetProperties: { properties: { sheetId: defectedSheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    { repeatCell: { range: { sheetId: defectedSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.12, green: 0.29, blue: 0.57 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId: defectedSheetId, startRowIndex: 1, endRowIndex: defectedValues.length, startColumnIndex: 0, endColumnIndex: 11 }, cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(verticalAlignment,wrapStrategy)" } },
    { updateDimensionProperties: { range: { sheetId: defectedSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 11 }, properties: { pixelSize: 155 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId: defectedSheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 360 }, fields: "pixelSize" } },
  ] } });
  if (resultCases.length) {
    const verification = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: resultSheetData.map((item) => item.range),
      valueRenderOption: "FORMULA",
    });
    verification.data.valueRanges?.forEach((range, index) => {
      const values = range.values ?? [];
      if (values.length < 4 || String(values[1]?.[0] ?? "") !== resultCases[index].id) {
        throw new Error(`เขียนข้อมูลลงแท็บ ${resultCases[index].id} ไม่สำเร็จ`);
      }
    });
  }
  if (defectedSheetData.length) {
    const verification = await sheets.spreadsheets.values.get({ spreadsheetId, range: `Defected!A1:K${defectedValues.length}`, valueRenderOption: "FORMULA" });
    const values = verification.data.values ?? [];
    if (String(values[0]?.[0] ?? "") !== "Defected Id" || values.length !== defectedValues.length) throw new Error("เขียนข้อมูลลงแท็บ Defected ไม่สำเร็จ");
  }
  return { updatedCells: result.data.totalUpdatedCells ?? 0, resultSheets: resultCases.length, defects: defectRecords.length };
}

function resultSheetValues(testCase: TestCase, defectDisplayIds = new Map<string, string>()) {
  const MAX_CELL_LENGTH = 45_000;
  const chunks = (value: string) => {
    if (!value) return [""];
    const parts: string[] = [];
    for (let index = 0; index < value.length; index += MAX_CELL_LENGTH) parts.push(value.slice(index, index + MAX_CELL_LENGTH));
    return parts;
  };
  const rows: unknown[][] = [
    ["Test Case Id", "Test Scenario*", "Test Case Name", "Test Step Description *", "Expected Result *"],
    [testCase.id, testCase.scenario, testCase.name, testCase.steps, testCase.expected],
    [],
    ["Result ID", "Status", "Actual Result", "API Response", "Log", "Evidence", "Defect", "Defect Status", "Jira URL", "Created At"],
  ];
  for (const item of testCase.results ?? []) {
    const result = item as TestResult;
    const columns = [
      chunks(result.actualResult),
      chunks(result.apiResponse),
      chunks(result.log),
      result.evidence.length
        ? result.evidence.map((evidence) => `=IMAGE("https://drive.usercontent.google.com/download?id=${evidence.fileId}&export=view",1)`)
        : [""],
      [""],
      [""],
      [""],
      chunks(result.createdAt),
    ];
    const rowCount = Math.max(...columns.map((column) => column.length));
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      rows.push([
        rowIndex === 0 ? result.id : "",
        rowIndex === 0 ? result.status : "",
        ...columns.map((column) => column[rowIndex] ?? ""),
      ]);
    }
  }
  if ((testCase.defects?.length ?? 0) > 0) {
    rows.push([], ["Defect ID", "Status", "Title", "Actual Result", "API Response", "Log", "Evidence", "Jira URL", "Created At"]);
    for (const defect of testCase.defects ?? []) {
      const columns = [chunks(defect.description), chunks(defect.apiResponse), chunks(defect.log), defect.evidence.length ? defect.evidence.map((evidence) => `=IMAGE("https://drive.usercontent.google.com/download?id=${evidence.fileId}&export=view",1)`) : [""], chunks(defect.jiraUrl), chunks(defect.createdAt)];
      const rowCount = Math.max(...columns.map((column) => column.length));
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) rows.push([rowIndex === 0 ? (defectDisplayIds.get(defect.id) ?? defect.id) : "", rowIndex === 0 ? defect.status : "", rowIndex === 0 ? defect.title : "", ...columns.map((column) => column[rowIndex] ?? "")]);
    }
  }
  return rows;
}
