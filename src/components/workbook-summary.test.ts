import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbookSummary } from "./workbook-summary";
import { casesFromRows } from "../lib/testcase-rows";
import { parseCoverSnapshot, validateWorkbook } from "../lib/workbook-validation";
import type { WorkbookSource } from "../lib/types";

test("overview preserves counts and Cover without displaying internal validation issues", () => {
  const cases = casesFromRows([
    ["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status"],
    ["TC01", "step 01", "Login", "Success", "Pass"],
    ["", "step 02", "Checkout", "Receipt", "Pass"],
  ]);
  const source: WorkbookSource = {
    fileName: "template", buffer: new ArrayBuffer(0), bufferLoaded: false,
    sheetName: "Testcase", sheetPath: "", columns: {}, sheets: [],
    coverSnapshot: parseCoverSnapshot([["System Name:", "QA Example"], ["Test Case"], ["14"]], "Cover"),
  };
  const report = validateWorkbook(cases, source);
  assert.ok(report.issues.some(issue => issue.code === "cover-count"));
  const html = renderToStaticMarkup(React.createElement(WorkbookSummary, { cases, source }));
  assert.match(html, /1 Test Cases · 2 Steps/);
  assert.match(html, /ข้อมูลจาก Cover/);
  assert.match(html, /QA Example/);
  assert.doesNotMatch(html, /ผลตรวจสอบของระบบ|workbook-validation-issues/);
  for (const issue of report.issues) assert.ok(!html.includes(issue.message));
});
