import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { casesFromRows } from "./testcase-rows";
import { parseStoredResults, serializeStoredResults } from "./project-data";
import { TestCaseSourceDetails } from "../components/test-case-source-details";

test("original column labels, duplicates and present blank values survive import and reopening", () => {
  const item = casesFromRows([["Test Case Id", "Test Case Name*", "Condition*", "Positive/Negative Case", "Custom", "Custom", "Notes"], ["TC01", "Checkout", "Member", "Positive", "one", "two", ""]])[0];
  const reopened = { ...item, ...parseStoredResults(serializeStoredResults(item)) };
  const html = renderToStaticMarkup(React.createElement(TestCaseSourceDetails, { testCase: reopened }));
  assert.match(html, /Condition\*/);
  assert.match(html, /Member/);
  assert.match(html, /Positive\/Negative Case/);
  assert.equal((html.match(/<dt>Custom<\/dt>/g) ?? []).length, 2);
  assert.match(html, /one/);
  assert.match(html, /two/);
  assert.match(html, /<dt>Notes<\/dt><dd[^>]*>—<\/dd>/);
  assert.doesNotMatch(html, /Test Scenario|Expected Result|เงื่อนไข/);
});

test("source labels show updated canonical and custom values rather than stale import values", () => {
  const item = casesFromRows([["Test Case Id", "Test Case Name*", "Extra"], ["TC01", "Old", "original"]])[0];
  item.name = "Edited name";
  item.customFields![0].value = "Edited extra";
  const html = renderToStaticMarkup(React.createElement(TestCaseSourceDetails, { testCase: item }));
  assert.match(html, /Edited name/);
  assert.match(html, /Edited extra/);
  assert.doesNotMatch(html, /Old|original/);
});

test("step templates keep separate case column titles without duplicating step details", () => {
  const item = casesFromRows([["Test Case (TC ID)", "Test Scenario*", "Test Scenario Description* (High Level Test Case)", "Step#", "Description Step", "Expected Result", "Positive/Negative Case"], ["TC01", "Scenario", "Context", "step 01", "Action", "Expected", "Positive"]])[0];
  const html = renderToStaticMarkup(React.createElement(TestCaseSourceDetails, { testCase: item }));
  assert.match(html, /Test Scenario Description\*/);
  assert.match(html, /Context/);
  assert.doesNotMatch(html, /Condition|Description Step|Expected Result/);
});

test("older cached cases retain custom columns even when they share a fallback card index", () => {
  const item = casesFromRows([["Test Case Id", "Test Scenario", "Custom", "Test Step Description", "Expected Result"], ["TC01", "Scenario", "Do not lose this", "Action", "Expected"]])[0];
  delete item.sourceFields;
  const html = renderToStaticMarkup(React.createElement(TestCaseSourceDetails, { testCase: item }));
  assert.match(html, /Custom/);
  assert.match(html, /Do not lose this/);
});
