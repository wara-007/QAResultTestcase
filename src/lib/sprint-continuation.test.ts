import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSprintDashboard } from './sprint-dashboard';
import { filterSprintProjectEntries, sprintEntryHref } from './sprint-project-entries';
import type { SnapshotHeader } from './project-sprint-participation';
test('continued projects stay in main entries and frozen totals, not live attention',()=>{
 const header={version:1,participation:{id:'e',projectId:'p',sprintId:'67',enteredAt:null,exitedAt:'2026-01-01',previousId:null,nextId:'next',actorName:'',reason:'continue',snapshotKind:'full'},project:{id:'p',name:'Old',description:'',environment:'UAT'},counts:{totalCases:2,pass:1,failed:0,skip:1,notStart:0,inProgress:0,openDefects:1,totalDefects:1,closedDefects:0},qa:[{userId:'qa',name:'QA',email:'qa@test',role:'qa'}],approval:{projectId:'p',total:1,approved:1,pending:0,changesRequested:0},source:null,destination:{sprintId:'68',sprintName:'68',year:2026}} as SnapshotHeader;
 const data=buildSprintDashboard({sprintId:'67',projects:[],team:[],assignments:[],stats:[],approvals:[],origins:[],moves:[],headers:[header],episodes:[header.participation]});
 assert.equal(data.entries.length,1);assert.equal(data.summary.totalCases,2);assert.equal(data.summary.skip,1);assert.equal(data.attention.length,0);
 assert.equal(filterSprintProjectEntries(data.entries,{query:'Old',qaId:'qa',scope:'continued'}).length,1);
 assert.equal(filterSprintProjectEntries(data.entries,{query:'',qaId:'other',scope:'all'}).length,0);
 assert.match(sprintEntryHref(data.entries[0],'g',2026),/\/67\/projects\/p\/history\/e$/);
 assert.equal(data.projects.length,0);
});
