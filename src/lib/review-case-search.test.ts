import test from 'node:test';
import assert from 'node:assert/strict';
import { casesFromRows } from './testcase-rows';
import { reviewCasePage } from './review-case-search';

const cases = casesFromRows([
  ['Test Case ID', 'Test Case Name', 'Test Scenario', 'Expected Result'],
  ...Array.from({length:23}, (_, i) => [`TC-${i + 1}`, `Login ${i + 1}`, 'ภาษาไทย ทดสอบ', 'Home page']),
]);

test('review searches every case before pagination and clamps an old page number', () => {
  const result = reviewCasePage(cases, ' tc-23 ', 3);
  assert.deepEqual(result.visible.map(item => item.id), ['TC-23']);
  assert.equal(result.total, 1);
  assert.equal(result.currentPage, 1);
});
test('review search supports names and details, while clearing restores ten cases per page', () => {
  assert.equal(reviewCasePage(cases, 'LOGIN 12', 1).visible[0].id, 'TC-12');
  assert.equal(reviewCasePage(cases, 'ภาษาไทย', 1).total, 23);
  const result = reviewCasePage(cases, '', 2);
  assert.equal(result.visible.length, 10);
  assert.equal(result.visible[0].id, 'TC-11');
  assert.equal(result.pageCount, 3);
});
test('no matches leave the source data unchanged and return an empty page', () => {
  const result = reviewCasePage(cases, 'missing', 8);
  assert.equal(result.total, 0);
  assert.deepEqual(result.visible, []);
  assert.equal(cases.length, 23);
});
