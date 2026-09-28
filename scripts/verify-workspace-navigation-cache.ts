import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/qa-workspace.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /hasDetailedGoogleData/,
  "workspace cache must remember whether full Google Sheet details were already loaded",
);
assert.doesNotMatch(
  source,
  /!cachedWorkspace\s*\|\|\s*testCaseId\s*\|\|\s*sheetName/,
  "opening a detail route must not always force a workspace reload",
);
assert.match(source, /loadProjectWorkspace\(selectedProject\.id,\s*\{\s*includeWorkbook:\s*false\s*\}\)/, "initial workspace load must skip workbook bytes");
assert.match(source, /const exportSource = await ensureWorkbookLoaded\(\)/, "export must await lazy workbook loading");
assert.match(source, /source\.bufferLoaded\s*\?\s*<ResultSheetViewer/, "sheet previews must not parse an unloaded workbook");

console.log("Workspace navigation cache regression checks passed");
