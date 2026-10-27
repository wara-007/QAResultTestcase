import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaseRegisterTable } from './case-register-table';
import { casesFromRows } from '../lib/testcase-rows';

const props: React.ComponentProps<typeof CaseRegisterTable> = {
  rows: [], columns: [{ key: 'id', label: 'Test Case ID', field: 'id' }],
  assigneeNames: () => '', associatedSheetNames: () => [],
  onOpen: () => {}, editingAssignments: false, isSelected: () => false,
  onToggle: () => {}, renderStatus: () => null, hasCases: false, onUpload: () => {},
};

test('loading the register displays placeholders in table cells, not an empty-project message', () => {
  const html = renderToStaticMarkup(React.createElement(CaseRegisterTable, { ...props, loading: true }));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /case-register-skeleton/);
  assert.doesNotMatch(html, /ยังไม่มี Testcase|ไม่พบ Testcase|อัปโหลดไฟล์/);
});

test('each testcase row opens its details without a separate Preview action', () => {
  const item = casesFromRows([['Test Case ID', 'Test Case Name'], ['TC01', 'Login']])[0];
  const html = renderToStaticMarkup(React.createElement(CaseRegisterTable, { ...props, rows: [{ item, sheetAlias: '' }] }));
  assert.doesNotMatch(html, /Preview/);
  assert.match(html, /aria-label="เปิด TC01"/);
});

test('an empty project is only shown after the register finishes loading', () => {
  const html = renderToStaticMarkup(React.createElement(CaseRegisterTable, { ...props, loading: false }));
  assert.match(html, /ยังไม่มี Testcase/);
  assert.doesNotMatch(html, /case-register-skeleton/);
});

function renderedRows(rows: React.ComponentProps<typeof CaseRegisterTable>['rows']) {
  const table = CaseRegisterTable({ ...props, rows }).props.children[0];
  return table.props.children[2].props.children as React.ReactElement<{ children: React.ReactElement[] }>[];
}

test('duplicate case IDs keep distinct row keys and their detail targets when reordered', () => {
  const item = casesFromRows([['Test Case ID', 'Test Case Name'], ['TC_06', 'First']])[0];
  const rows = [
    { item, sheetAlias: '' },
    { item: { ...item, sourceRow: item.sourceRow + 1, name: 'Second' }, sheetAlias: '' },
    { item, sheetAlias: 'testcase' },
    { item: { ...item, recordId: 'saved-row' }, sheetAlias: '' },
    { item: { ...item, sourceSheetName: 'Other' }, sheetAlias: '' },
  ];
  const before = renderedRows(rows);
  assert.equal(new Set(before.map(row => row.key)).size, rows.length);
  const after = renderedRows([...rows].reverse());
  assert.deepEqual(after.map(row => row.key), before.map(row => row.key).reverse());
  const opened: unknown[] = [];
  const tree = CaseRegisterTable({ ...props, rows, onOpen: row => opened.push(row) });
  const fragments = tree.props.children[0].props.children[2].props.children;
  for (const fragment of fragments) fragment.props.children[1].props.onClick();
  assert.deepEqual(opened, rows);
});

test('repeated source entries still render with unique keys', () => {
  const item = casesFromRows([['Test Case ID', 'Test Case Name'], ['TC_06', 'First']])[0];
  const rows = renderedRows([{ item, sheetAlias: '' }, { item, sheetAlias: '' }]);
  assert.notEqual(rows[0].key, rows[1].key);
});
