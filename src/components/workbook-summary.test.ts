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
  assert.match(html, /Test Cases<\/dt><dd>1<\/dd>/);
  assert.match(html, /Steps<\/dt><dd>2<\/dd>/);
  assert.match(html, /ข้อมูลจาก Cover/);
  assert.match(html, /QA Example/);
  assert.doesNotMatch(html, /ผลตรวจสอบของระบบ|workbook-validation-issues/);
  for (const issue of report.issues) assert.ok(!html.includes(issue.message));
});

test("Cover separates long descriptions and renders external references as short safe links", () => {
  const cover = parseCoverSnapshot([["System Name:", "TrueApp"]], "Cover")!;
  cover.fields = [
    { label: "EPIC:", value: "Migrate Call Gen" },
    { label: "Description:", value: "รายละเอียดโครงการ\nข้อความที่ต้องอ่านได้เต็มความกว้าง" },
    { label: "Jira No.:", value: "https://trueomx.atlassian.net/browse/JPT-1765" },
    { label: "Requirements:", value: "https://trueomx.atlassian.net/wiki/spaces/Jupiter/pages/123?very=long" },
  ];
  const source: WorkbookSource = { fileName: "test", buffer: new ArrayBuffer(0), bufferLoaded: false, sheetName: "Testcase", sheetPath: "", columns: {}, sheets: [], coverSnapshot: cover };
  const html = renderToStaticMarkup(React.createElement(WorkbookSummary, { cases: [], source }));
  assert.match(html, /workbook-cover-description/);
  assert.match(html, /รายละเอียดโครงการ\nข้อความที่ต้องอ่านได้เต็มความกว้าง/);
  assert.match(html, /href="https:\/\/trueomx.atlassian.net\/browse\/JPT-1765"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, />JPT-1765</);
  assert.doesNotMatch(html, />https:\/\/trueomx/);
  assert.match(html, /Migrate Call Gen/);
  assert.match(html, /ดูข้อมูลต้นฉบับทั้งหมดจาก Cover/);
});
