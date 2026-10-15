import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaseRegisterTable } from './case-register-table';
import { casesFromRows } from '../lib/testcase-rows';

const props: React.ComponentProps<typeof CaseRegisterTable> = {
  rows: [], columns: [{ key: 'id', label: 'Test Case ID', field: 'id' }],
  getRowState: () => 'idle', getRowLoadLabel: () => '', assigneeNames: () => '', associatedSheetNames: () => [],
  onOpen: () => {}, onRetry: () => {}, editingAssignments: false, isSelected: () => false,
  onToggle: () => {}, renderStatus: () => null, hasCases: false, onUpload: () => {},
};

test('loading the register displays placeholders in table cells, not an empty-project message', () => {
  const html = renderToStaticMarkup(React.createElement(CaseRegisterTable, { ...props, loading: true }));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /case-register-skeleton/);
  assert.doesNotMatch(html, /ยังไม่มี Testcase|ไม่พบ Testcase|อัปโหลดไฟล์/);
});

test('each testcase row exposes preview separately from opening its editor', () => {
  const item = casesFromRows([['Test Case ID', 'Test Case Name'], ['TC01', 'Login']])[0];
  const html = renderToStaticMarkup(React.createElement(CaseRegisterTable, { ...props, rows: [{ item, sheetAlias: '' }], onPreview: () => {} }));
  assert.match(html, /aria-label="Preview TC01"/);
  assert.match(html, /aria-label="เปิด TC01"/);
});

test('an empty project is only shown after the register finishes loading', () => {
  const html = renderToStaticMarkup(React.createElement(CaseRegisterTable, { ...props, loading: false }));
  assert.match(html, /ยังไม่มี Testcase/);
  assert.doesNotMatch(html, /case-register-skeleton/);
});
