import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleDataRange } from './google-data-range';

test('formatting ranges exclude unused grid rows and columns but include every populated cell', () => {
  assert.equal(googleDataRange('RC TC-01', [['title'], [], ['', '', 'log']]), "'RC TC-01'!A1:C3");
  assert.equal(googleDataRange("QA's result", [['', '', ''], []]), "'QA''s result'!A1:A1");
  const row = Array(28).fill(''); row[27] = 'highlighted log';
  assert.equal(googleDataRange('TC02', [row]), "'TC02'!A1:AB1");
});
