import fs from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { unzipSync } from "fflate";

async function main() {
  Object.assign(globalThis, { DOMParser, XMLSerializer });
  const { importTestCases, exportTestCases } = await import("../src/lib/excel-ooxml");
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new Error("Usage: pnpm test:excel -- /absolute/path/to/source.xlsx");
  const originalBytes = await fs.readFile(sourcePath);
  const sourceBuffer = originalBytes.buffer.slice(originalBytes.byteOffset, originalBytes.byteOffset + originalBytes.byteLength);
  const imported = importTestCases(sourceBuffer, "source.xlsx");
  const importedStatusCounts = Object.fromEntries(["Not Start", "In Progress", "Pass", "Failed", "Skip"].map((status) => [status, imported.cases.filter((testCase) => testCase.status === status).length]));

  if (imported.cases.length !== 32) throw new Error(`Expected 32 cases, found ${imported.cases.length}`);
  if (importedStatusCounts.Pass !== 28 || importedStatusCounts.Skip !== 4) throw new Error(`Unexpected imported statuses: ${JSON.stringify(importedStatusCounts)}`);
  if (imported.source.sheets.length !== 40) throw new Error(`Expected 40 sheets, found ${imported.source.sheets.length}`);
  const indexedImages = imported.source.sheets.reduce((total, sheet) => total + sheet.imageCount, 0);
  if (indexedImages !== 98) throw new Error(`Expected 98 indexed images, found ${indexedImages}`);
  const tc01Sheets = imported.source.sheets.filter((sheet) => sheet.testCaseIds.includes("TC-01"));
  if (!tc01Sheets.length) throw new Error("TC-01 result sheet was not linked");
  const changedCases = imported.cases.map((testCase, index) =>
    index === 0 ? { ...testCase, status: "Failed" as const, remark: "Automated export verification" } : testCase,
  );
  const outputBytes = exportTestCases(imported.source, changedCases);
  const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength);
  const verified = importTestCases(outputBuffer, "result.xlsx");
  const firstCase = verified.cases[0];
  if (firstCase.status !== "Failed" || firstCase.remark !== "Automated export verification") {
    throw new Error("Exported result fields did not round-trip");
  }

  const originalArchive = unzipSync(originalBytes);
  const outputArchive = unzipSync(outputBytes);
  const originalMedia = Object.keys(originalArchive).filter((path) => path.startsWith("xl/media/")).length;
  const outputMedia = Object.keys(outputArchive).filter((path) => path.startsWith("xl/media/")).length;
  const originalSheets = Object.keys(originalArchive).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path)).length;
  const outputSheets = Object.keys(outputArchive).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path)).length;
  if (originalMedia !== outputMedia || originalSheets !== outputSheets) throw new Error("Workbook structure changed during export");

  console.log(JSON.stringify({ cases: verified.cases.length, sheets: outputSheets, resultSheets: verified.source.sheets.filter((sheet) => sheet.kind === "result").length, media: outputMedia, indexedImages, importedStatusCounts, firstStatus: firstCase.status }));
}

void main();
