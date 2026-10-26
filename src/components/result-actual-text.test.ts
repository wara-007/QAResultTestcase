import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultActualText } from "./result-actual-text";

test("ordinary result text is prose while JSON retains the code viewer", () => {
  const prose = renderToStaticMarkup(React.createElement(ResultActualText, { text: "แสดงหน้าแพ็กเกจถูกต้อง" }));
  assert.match(prose, /<p/);
  assert.doesNotMatch(prose, /result-code-editor|ค้นหาข้อความ/);
  const json = renderToStaticMarkup(React.createElement(ResultActualText, { text: '{"ok":true}' }));
  assert.match(json, /result-code-editor/);
});
