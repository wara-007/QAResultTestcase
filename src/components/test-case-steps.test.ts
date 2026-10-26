import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestCaseSteps } from './test-case-steps';
import { casesFromRows } from '../lib/testcase-rows';

test('Step status is hidden on both editable and read-only pages without changing stored status', () => {
  const item = casesFromRows([
    ['Test Case (TC ID)', 'Step#', 'Description Step', 'Expected Result', 'Status'],
    ['TC01', 'step 01', 'Login', 'Home', 'Pass'],
  ])[0];
  for (const readOnly of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(TestCaseSteps, { testCase: item, readOnly }));
    assert.match(html, /Login/);
    assert.match(html, /Home/);
    assert.doesNotMatch(html, /สถานะ Step|<select|Pass|Passed/);
  }
  assert.equal(item.stepDefinitions?.[0].status, 'Pass');
  assert.equal(item.status, 'Pass');
});

test('missing Ref tab warnings are visible on cases without a Step table', () => {
  const item = casesFromRows([['Test Case Id', 'Test Case Name'], ['TC01', 'First']])[0];
  item.importIssues = ['Ref (Result Testing): ไม่พบแท็บที่อ้างอิง "Proof A"'];
  const html = renderToStaticMarkup(React.createElement(TestCaseSteps, { testCase: item, readOnly: true }));
  assert.match(html, /ไม่พบแท็บที่อ้างอิง/);
  assert.match(html, /Proof A/);
});
