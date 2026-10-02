import test from "node:test";
import assert from "node:assert/strict";
import { withCachedProjectDefects } from "./project-defect-cache";
import type { WorkbookSheet } from "./types";

test("fresh Defected metadata updates the stored counter input without replacing workbook coordinates", () => {
  const mapping = { chunkCount: 3, id: "A", sheets: [{ name: "Defected", path: "xl/worksheets/sheet2.xml", imageCount: 5 }] };
  const incoming = [{ name: "Defected", path: "google:42", defects: [{ id: "DEF-01", status: "Passed" }] }] as WorkbookSheet[];
  const result = withCachedProjectDefects(mapping, incoming);
  assert.equal(result.chunkCount, 3);
  assert.equal(result.id, "A");
  assert.equal(result.sheets[0].path, "xl/worksheets/sheet2.xml");
  assert.equal(result.sheets[0].imageCount, 5);
  assert.equal(result.sheets[0].defects?.[0].id, "DEF-01");
});

test("a successfully read empty register clears old counts, but missing metadata does not", () => {
  const mapping = { sheets: [{ name: "Defected", defects: [{ id: "DEF-01" }] }] };
  assert.deepEqual(withCachedProjectDefects(mapping, [{ name: "Defected", defects: [] }] as unknown as WorkbookSheet[]).sheets[0].defects, []);
  assert.deepEqual(withCachedProjectDefects(mapping, [] as WorkbookSheet[]).sheets[0].defects, [{ id: "DEF-01" }]);
});
