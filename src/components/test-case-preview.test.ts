import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestCasePreview } from './test-case-preview';
import { casesFromRows } from '../lib/testcase-rows';

test('preview opens every Step by default', () => {
  const stepCase = casesFromRows([
    ['Test Case (TC ID)', 'Step#', 'Description Step', 'Expected Result', 'Status'],
    ['TC01', 'step 01', 'Login', 'Home', 'Pass'],
    ['', 'step 02', 'Open menu', 'Menu', 'Pass'],
  ])[0];
  assert.equal(stepCase.stepDefinitions?.length, 2);
  const html = renderToStaticMarkup(React.createElement(TestCasePreview, { testCase: stepCase, projectId: 'p', backHref: '/cases' }));
  const steps = html.match(/<details class="test-case-step"[^>]*>/g) ?? [];
  assert.equal(steps.length, 2);
  assert.ok(steps.every(step => step.includes('open=""')));
  const summaries = html.match(/<summary>[\s\S]*?<\/summary>/g) ?? [];
  assert.ok(summaries.length >= 2);
  assert.ok(summaries.every(summary => !summary.includes('Pass')));
});

const item = casesFromRows([['Test Case ID', 'Test Case Name', 'Expected Result'], ['TC01', 'Login success', 'Home page']])[0];
item.results = [
  { id: 'r1', status: 'Pass', actualResult: 'First result', apiResponse: '', log: '', evidence: [], createdAt: '', sourceSheetName: 'RC TC01' },
  { id: 'r2', status: 'Failed', actualResult: 'Second result', apiResponse: '', log: '', evidence: [], createdAt: '', sourceSheetName: 'RC TC01 retest' },
];
item.defects = [{ id: 'D01', title: 'Defect title', description: 'Defect description', status: 'Open', jiraUrl: 'https://example.com/D01', apiResponse: '', log: '', evidence: [], createdAt: '' }];

test('preview shows source details, every result and defects without editing forms', () => {
  const html = renderToStaticMarkup(React.createElement(TestCasePreview, { testCase: item, projectId: 'p', backHref: '/cases', editHref: '/cases/TC01' }));
  for (const value of ['Login success', 'Home page', 'First result', 'Second result', 'Defect title', 'Defect description']) assert.ok(html.includes(value));
  assert.match(html, /href="\/cases\/TC01"/);
  assert.match(html, /href="\/cases"/);
  assert.doesNotMatch(html, /<textarea|Add Result|Add Defect|บันทึก Result/);
});

test('preview keeps source tabs separate and hides edit for viewers', () => {
  const html = renderToStaticMarkup(React.createElement(TestCasePreview, { testCase: item, projectId: 'p', backHref: '/cases', sourceSheetName: 'RC TC01 retest' }));
  assert.match(html, /Second result/);
  assert.doesNotMatch(html, /First result|แก้ไข Test Case/);
  assert.match(html, /RC TC01 retest/);
});

test('preview waiting for details does not falsely report missing results', () => {
  const html = renderToStaticMarkup(React.createElement(TestCasePreview, { testCase: { ...item, results: [] }, projectId: 'p', backHref: '/cases', loading: true }));
  assert.match(html, /กำลังโหลดรายละเอียด/);
  assert.doesNotMatch(html, /ยังไม่มี Result/);
});
