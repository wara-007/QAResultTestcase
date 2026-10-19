import test from 'node:test';
import assert from 'node:assert/strict';
import { sortSprints, parseSprintSort } from './sprint-sort';

// Planning returns Sprints ordered by created_at descending.
const sprints = [
  { id: 'new', name: 'Sprint 10', startDate: '2026-02-01' },
  { id: 'no-date', name: 'Sprint 11', startDate: '' },
  { id: 'old', name: 'Sprint 9', startDate: '2026-03-01' },
];
test('creation sorting defaults to newest and does not confuse it with start dates', () => {
  assert.equal(parseSprintSort(null), 'created-desc');
  assert.equal(parseSprintSort('invalid'), 'created-desc');
  assert.deepEqual(sortSprints(sprints, 'created-desc').map(s => s.id), ['new', 'no-date', 'old']);
  assert.deepEqual(sortSprints(sprints, 'created-asc').map(s => s.id), ['old', 'no-date', 'new']);
  assert.deepEqual(sprints.map(s => s.id), ['new', 'no-date', 'old']);
});
test('start date sorting supports both directions and always places missing dates last', () => {
  assert.deepEqual(sortSprints(sprints, 'start-desc').map(s => s.id), ['old', 'new', 'no-date']);
  assert.deepEqual(sortSprints(sprints, 'start-asc').map(s => s.id), ['new', 'old', 'no-date']);
});
test('Sprint names sort naturally, with 9 before 10 and 11', () => {
  assert.deepEqual(sortSprints(sprints, 'name-asc').map(s => s.id), ['old', 'new', 'no-date']);
  assert.deepEqual(sortSprints(sprints, 'name-desc').map(s => s.id), ['no-date', 'new', 'old']);
  assert.equal(parseSprintSort('start-asc'), 'start-asc');
});
