import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReportDate } from './date-format';

test('reports show Thai local execution time and do not invent times for date-only sources',()=>{
 assert.match(formatReportDate('2026-10-10T02:30:00Z'),/09:30/);
 assert.doesNotMatch(formatReportDate('2026-10-10'),/:/);
 assert.equal(formatReportDate('bad'),'ไม่ระบุเวลา');
});
