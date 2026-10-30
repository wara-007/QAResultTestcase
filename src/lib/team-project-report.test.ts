import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSprintDashboard, type SprintDashboardData, type MoveSnapshot } from './sprint-dashboard';
import type { Project, PlanningTeamMember } from './types';
import type { PersonalCase } from './personal-test-performance';
import type { SnapshotHeader } from './project-sprint-participation';
import { buildTeamProjectReport } from './team-project-report';

const member:PlanningTeamMember={userId:'qa',name:'QA One',email:'qa@example.test',role:'qa'};
const counts:MoveSnapshot={totalCases:3,pass:3,failed:0,inProgress:0,skip:0,notStart:0,openDefects:0};
function dashboard(options:{assigned?:boolean;counts?:MoveSnapshot;cases?:PersonalCase[];approval?:'approved'|'pending'|'changes'}={}):SprintDashboardData {
  return buildSprintDashboard({sprintId:'s',projects:[{id:'p',name:'Payment',sprintId:'s',environment:'UAT'}] as Project[],team:[member],assignments:options.assigned===false?[]:[{projectId:'p',userId:'qa'}],stats:[],origins:[],moves:[],personalCases:options.cases ?? [],summaries:[{projectId:'p',counts:options.counts ?? counts}],approvals:options.approval?[{projectId:'p',total:1,approved:options.approval==='approved'?1:0,pending:options.approval==='pending'?1:0,changesRequested:options.approval==='changes'?1:0}]:[]});
}
function recorded(testerName='QA One',testerId:string|undefined='qa'):PersonalCase {
  return {projectId:'p',projectName:'Payment',currentSprintId:'s',caseId:'TC1',caseName:'Download',sourceRowKey:'base',detailPath:'/case/TC1',assignedUserIds:[],results:[{id:'r',testerName,testerId,status:'Pass',source:'web',sourceSheet:'Results',recordedAt:'2026-10-24T10:00:00Z',order:1,originSprintId:'s',inferred:false}]};
}

test('project QA with no personal results still sees assigned projects without invented work',()=>{
  const {people}=buildTeamProjectReport(dashboard(),'g',2026);
  assert.equal(people.length,1);
  assert.equal(people[0].projects[0].role,'project_qa');
  assert.equal(people[0].projects[0].recordedResults,0);
  assert.match(people[0].projects[0].workSummary,/ยังไม่มีผลทดสอบ/);
  assert.equal(people[0].projects[0].state,'ready_for_review');
  assert.equal(people[0].totals.approved,0);
});

test('recorded contributors are linked to projects without being labelled project owners',()=>{
  const {people}=buildTeamProjectReport(dashboard({assigned:false,cases:[recorded()]}),'g',2026);
  assert.equal(people[0].projects[0].role,'contributor');
  assert.equal(people[0].projects[0].activity[0].detailPath,'/case/TC1');
  assert.equal(people[0].projects[0].href,'/groups/g/projects/p/overview');
});

test('unmatched imported names stay separate from accounts; anonymous work stays in issues',()=>{
  const named=recorded('QA Alias',undefined);
  named.results[0].testerId=undefined;
  const unnamed=recorded('',undefined);unnamed.caseId='TC2';unnamed.results[0].testerId=undefined;
  const data=dashboard({cases:[named,unnamed]});
  const result=buildTeamProjectReport(data,'g',2026);
  assert.equal(result.people.length,2);
  assert.equal(result.people.find(p=>p.key==='name:qa alias')?.unresolved,true);
  assert.equal(result.people.find(p=>p.key==='qa')?.projects[0].recordedResults,0);
  assert.equal(result.issues.unnamedResults,1);
  assert.equal(result.issues.unresolvedPeople,1);
  assert.ok(result.people.every(p=>p.key!=='unknown'&&p.key!=='unassigned'));
});

test('approved, pending and changes requested statuses use actual PO state',()=>{
  for(const [approval,want] of [['approved','approved'],['pending','waiting_approval'],['changes','changes_requested']] as const){
    const person=buildTeamProjectReport(dashboard({approval}),'g',2026).people[0];
    assert.equal(person.projects[0].state,want);
    assert.equal(person.totals.approved,approval==='approved'?1:0);
    assert.doesNotMatch(person.projects[0].label,/ปิด Project/);
  }
});

test('failed cases and unfinished work cannot become approved outcomes; missing summaries stay unknown',()=>{
  const failed=dashboard({approval:'approved',counts:{...counts,pass:2,failed:1}});
  assert.equal(buildTeamProjectReport(failed,'g',2026).people[0].projects[0].state,'needs_attention');
  const active=dashboard({counts:{...counts,pass:2,notStart:1}});
  assert.equal(buildTeamProjectReport(active,'g',2026).people[0].projects[0].state,'testing');
  active.summaryPending=['p'];
  assert.equal(buildTeamProjectReport(active,'g',2026).people[0].projects[0].state,'unknown');
});

test('continued work uses frozen QA and links to its history rather than claiming closure',()=>{
  const data=dashboard({assigned:false});
  const header:SnapshotHeader={version:1,participation:{id:'ep',projectId:'old',sprintId:'s',enteredAt:null,exitedAt:'2026-10-24',previousId:null,nextId:'next',actorName:'QA',reason:'continue',snapshotKind:'full'},project:{id:'old',name:'Archived',description:'',environment:'UAT'},counts:{...counts,pass:2,notStart:1},qa:[member],approval:{projectId:'old',total:0,approved:0,pending:0,changesRequested:0},source:null};
  data.entries.push({projectId:'old',sprintId:'s',name:'Archived',kind:'continued',participationId:'ep',destination:null,historical:header});
  const project=buildTeamProjectReport(data,'g',2026).people[0].projects[0];
  assert.equal(project.state,'continued');
  assert.equal(project.counts?.notStart,1);
  assert.equal(project.href,'/groups/g/years/2026/sprints/s/projects/old/history/ep');
});

test('empty Sprints return no invented team members or projects',()=>{
  const data=buildSprintDashboard({sprintId:'s',projects:[],team:[member],assignments:[],stats:[],approvals:[],origins:[],moves:[]});
  assert.deepEqual(buildTeamProjectReport(data,'g',2026).people,[]);
});

test('project collaborators count completed cases once per person across result sheets and summarize actual work',()=>{
  const one=recorded();
  const duplicate=recorded();duplicate.sourceRowKey='Other results';
  const two=recorded('QA Two','qa2');two.caseId='TC2';two.caseName='Cancel payment';
  const skip=recorded('QA Two','qa2');skip.caseId='TC3';skip.caseName='Refund';skip.results[0].status='Skip';
  const active=recorded('QA Two','qa2');active.caseId='TC4';active.caseName='Receipt';active.results[0].status='In Progress';
  const unknown=recorded('',undefined);unknown.results[0].testerId=undefined;unknown.caseId='TC5';
  const data=dashboard({cases:[one,duplicate,two,skip,active,unknown]});
  data.projects[0].qa.push({userId:'qa3',name:'QA Three',email:'qa3@example.test',role:'qa'});
  const project=buildTeamProjectReport(data,'g',2026).people.find(p=>p.key==='qa')!.projects[0];
  assert.deepEqual(project.collaborators.map(p=>({key:p.key,tested:p.testedCases,skipped:p.skippedCases,active:p.inProgressCases})).sort((a,b)=>a.key.localeCompare(b.key)),[
    {key:'qa',tested:1,skipped:0,active:0},
    {key:'qa2',tested:1,skipped:1,active:1},
    {key:'qa3',tested:0,skipped:0,active:0},
  ]);
  assert.deepEqual(project.collaborators.find(p=>p.key==='qa2')!.caseNames,['Cancel payment','Refund']);
  assert.equal(project.collaborators.find(p=>p.key==='qa3')!.assignedOnly,true);
  assert.ok(project.collaborators.every(p=>p.key!=='unknown'));
});

test('collaborator summaries exclude other projects and keep imported names separate',()=>{
  const actual=recorded();
  const alias=recorded('QA Alias');alias.results[0].testerId=undefined;
  const other=recorded('Other Person','other');other.projectId='other';other.projectName='Other Project';
  const project=buildTeamProjectReport(dashboard({cases:[actual,alias,other]}),'g',2026).people.find(p=>p.key==='qa')!.projects[0];
  assert.equal(project.collaborators.length,2);
  assert.equal(project.collaborators.find(p=>p.key==='name:qa alias')!.unresolved,true);
  assert.equal(project.collaborators.find(p=>p.key==='qa')!.testedCases,1);
});

test('project view lists each project once and retains work without assigned QA or named testers',()=>{
  const first=recorded();
  const second=recorded('QA Two','two');
  const data=dashboard({cases:[first,second]});
  data.entries.push({projectId:'empty',sprintId:'s',name:'Unassigned',kind:'current',participationId:'',destination:null,historical:null});
  data.projects.push({...data.projects[0],id:'empty',name:'Unassigned',qa:[],counts:{...data.projects[0].counts,totalCases:0,pass:0}});
  const report=buildTeamProjectReport(data,'g',2026);
  assert.equal(report.projects.length,2);
  assert.equal(report.projects.find(p=>p.projectId==='p')!.collaborators.length,2);
  assert.deepEqual(report.projects.find(p=>p.projectId==='p')!.qaNames,['QA One']);
  assert.deepEqual(report.projects.find(p=>p.projectId==='empty')!.qaNames,[]);
  assert.equal(report.projects.find(p=>p.projectId==='empty')!.state,'not_started');
});
