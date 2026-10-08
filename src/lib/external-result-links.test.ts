import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { SheetResultSections } from "../components/sheet-result-sections";

test("an outgoing proof link displays an external-link icon and new-tab hint while retaining its highlight", () => {
  const html = renderToStaticMarkup(React.createElement(SheetResultSections, { sections: [{ id: "proof", title: "Result", kind: "fields", rows: [{ row: 10, fields: [{ ref: "B10", label: "ผลการทดสอบ", value: "Home page_Login TOL", link: "https://drive.google.com/open?id=proof", highlights: [{ start: 0, end: 4, background: "#ffff00" }] }] }] }] }));
  assert.match(html, /target="_blank"/);
  assert.match(html, /lucide-external-link/);
  assert.match(html, /title="เปิดในแท็บใหม่"/);
  assert.match(html, /background-color:#ffff00/);
});

test("ordinary proof text has no outgoing-link icon", () => {
  const html = renderToStaticMarkup(React.createElement(SheetResultSections, { sections: [{ id: "text", title: "Result", kind: "fields", rows: [{ row: 10, fields: [{ ref: "B10", label: "ผลการทดสอบ", value: "หน้าจอถูกต้อง" }] }] }] }));
  assert.match(html, /หน้าจอถูกต้อง/);
  assert.doesNotMatch(html, /lucide-external-link/);
});
