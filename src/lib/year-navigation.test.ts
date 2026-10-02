import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkspaceYear, availableWorkspaceYears, groupsForYearHref, groupSprintsHref } from './year-navigation';

test('year selection merges all groups years without duplicate years and includes current year',()=>{
  assert.deepEqual(availableWorkspaceYears([2025,2026,2025,2027],2026),[2027,2026,2025]);
  assert.deepEqual(availableWorkspaceYears([],2026),[2026]);
});
test('invalid or ambiguous URL years never enter a group Sprint route',()=>{
  for(const value of [undefined,'','2026abc','2026.5','1999','2201',['2026','2025']]) assert.equal(parseWorkspaceYear(value),undefined);
  assert.equal(parseWorkspaceYear('2026'),2026);
});
test('selected year is carried into Groups and group Sprint links',()=>{
  assert.equal(groupsForYearHref(2026),'/groups?year=2026');
  assert.equal(groupSprintsHref('team one',2026),'/groups/team%20one/years/2026/sprints');
});
