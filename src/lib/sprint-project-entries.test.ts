import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSprintDashboard } from './sprint-dashboard';
import { filterSprintProjectEntries } from './sprint-project-entries';

test('Sprint list search finds current projects by their descriptions', () => {
  const data = buildSprintDashboard({ sprintId: 's', projects: [{ id: 'p', sprintId: 's', name: 'Mobile', description: 'Checkout regression', sprintNo: '1', environment: 'UAT', googleSheetId: '', googleSheetUrl: '', createdAt: '', canView: true, canEdit: false, canManage: false, canDelete: false }], team: [], assignments: [], stats: [], origins: [], moves: [], approvals: [] });
  const matches = filterSprintProjectEntries(data.entries, { query: ' CHECKOUT ', qaId: '', scope: 'current' });
  assert.deepEqual(matches.map(entry => entry.projectId), ['p']);
});
