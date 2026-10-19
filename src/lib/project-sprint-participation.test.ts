import assert from 'node:assert/strict';
import test from 'node:test';
import { selectSprintProjectEpisodes, type Participation } from './project-sprint-participation';

const episode = (id:string, sprintId:string, exitedAt:string|null, projectId='p'):Participation => ({id,projectId,sprintId,enteredAt:id,exitedAt,previousId:null,nextId:null,actorName:'',reason:'',snapshotKind:exitedAt ? 'full' : 'none'});
test('reentry prefers active episode and later departure selects only latest exit per project',()=>{
  const rows=[episode('1','a','2026-01-01'),episode('2','b','2026-02-01'),episode('3','a',null),episode('4','a','2026-03-01','other')];
  assert.deepEqual(selectSprintProjectEpisodes('a',rows).map(r=>r.id),['3','4']);
  rows[2]={...rows[2],exitedAt:'2026-04-01'};
  assert.deepEqual(selectSprintProjectEpisodes('a',rows).map(r=>r.id),['3','4']);
  assert.equal(rows.length,4);
});
