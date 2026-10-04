import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewResultContent } from "../components/review-workspace";
import type { TestResult } from "./types";

test("review uses spatial sheet sections instead of repeating the combined imported text", () => {
  const result: TestResult = { id: "import", sourceSheetName: "RC TC-01", status: "Pass", actualResult: "LEGACY DUPLICATE", apiResponse: "LEGACY API", log: "", evidence: [], createdAt: "", sheetSections: [
    { id: "first", rows: [{ row: 4, fields: [{ ref: "G4", label: "API", value: 'Response body:\n{"ok":true}' }] }], title: "" },
    { id: "second", rows: [{ row: 31, fields: [{ ref: "A31", label: "Notes", value: "Data not found" }] }], title: "" },
  ] };
  const html = renderToStaticMarkup(createElement(ReviewResultContent, { result, evidenceBasePath: "/api/approvals/test/evidence" }));
  assert.ok(html.includes("ชุดผลการทดสอบ 1"));
  assert.ok(html.includes("ชุดผลการทดสอบ 2"));
  assert.ok(html.includes("Data not found"));
  assert.ok(html.includes("result-code-editor"));
  assert.ok(!html.includes("LEGACY"));
  assert.ok(!html.includes("แก้ไข / Highlight"));
});
