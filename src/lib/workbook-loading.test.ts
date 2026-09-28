import assert from "node:assert/strict";
import test from "node:test";
import { assembleWorkbookBytes } from "./project-data";

test("metadata-only workspace does not call workbook downloader", async () => {
  let calls = 0;
  const bytes = await assembleWorkbookBytes({
    chunkCount: 2,
    storageKey: "project/source.xlsx",
    download: async () => { calls += 1; return new Uint8Array([1]); },
    includeWorkbook: false,
  });
  assert.equal(calls, 0);
  assert.equal(bytes.byteLength, 0);
});

test("chunked workbook is assembled in index order", async () => {
  const requested: string[] = [];
  const bytes = await assembleWorkbookBytes({
    chunkCount: 2,
    storageKey: "project/source.xlsx",
    download: async (path) => {
      requested.push(path);
      return new Uint8Array([path.endsWith("001") ? 2 : 1]);
    },
    includeWorkbook: true,
  });
  assert.deepEqual(requested, ["project/source.xlsx/part-000", "project/source.xlsx/part-001"]);
  assert.deepEqual([...new Uint8Array(bytes)], [1, 2]);
});

test("legacy workbook downloads its single storage key", async () => {
  const requested: string[] = [];
  await assembleWorkbookBytes({
    chunkCount: 0,
    storageKey: "project/source.xlsx",
    download: async (path) => { requested.push(path); return new Uint8Array([1]); },
    includeWorkbook: true,
  });
  assert.deepEqual(requested, ["project/source.xlsx"]);
});
