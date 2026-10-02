import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSprintDashboard, filterDashboardProjects } from './sprint-dashboard';

const project = (id: string, sprintId: string) => ({ id, sprintId, name: id, description: '', sprintNo: 'Sprint', environment: 'UAT', googleSheetId: '', googleSheetUrl: '', createdAt: '', canView: true, canEdit: false, canManage: false, canDelete: false });
const team = [{ userId: 'qa1', name: 'QA One', email: 'one@example.com', role: 'qa' }, { userId: 'qa2', name: 'QA Two', email: 'two@example.com', role: 'qa' }];

test('current metrics count a shared project once, while contributions retain moved-out origin and exclude imports', () => {
  const data = buildSprintDashboard({ sprintId: 's1', projects: [project('Current','s1'),project('Moved','s2')], team,
    assignments: [{projectId:'Current',userId:'qa1'},{projectId:'Current',userId:'qa2'}],
    stats: [{id:'Current',cases:[{executions:[{attempt_no:1,status:'Failed',result_reference:''}]}],approvals:[]}],
    approvals: [{projectId:'Current',total:2,approved:1,pending:1,changesRequested:0}], moves: [],
    origins: [
      {projectId:'Moved',testCaseId:'tc1',resultId:'r1',sourceSheet:'',sprintId:'s1',authorId:'qa1',authorName:'QA One',inferred:false,recordedAt:'2026-10-01T08:00:00Z',active:true,status:'Pass'},
      {projectId:'Moved',testCaseId:'tc1',resultId:'r2',sourceSheet:'',sprintId:'s1',authorId:'qa1',authorName:'QA One',inferred:false,recordedAt:'2026-10-01T09:00:00Z',active:true,status:'Pass'},
      {projectId:'Current',testCaseId:'tc2',resultId:'r3',sourceSheet:'',sprintId:'s2',authorId:'qa2',authorName:'QA Two',inferred:false,recordedAt:'',active:true,status:'Pass'},
      {projectId:'Current',testCaseId:'tc3',resultId:'r4',sourceSheet:'RC TC-03',sprintId:'s1',authorId:null,authorName:'',inferred:true,recordedAt:'',active:true,status:'Pass'},
      {projectId:'Current',testCaseId:'tc4',resultId:'r5',sourceSheet:'',sprintId:'s1',authorId:'qa1',authorName:'QA One',inferred:false,recordedAt:'',active:false,status:'Pass'},
    ] });
  assert.equal(data.summary.projects,1); assert.equal(data.summary.failed,1);
  assert.equal(data.projects[0].qa.length,2); assert.equal(data.projects[0].approval.label,'รอรีวิว · Approved 1/2');
  assert.equal(data.team[0].results,2); assert.equal(data.team[0].cases,1); assert.equal(data.team[0].assignedProjects,1);
  assert.equal(data.team[1].results,0); assert.equal(data.inferredResults,1);
  assert.equal(data.attention.filter(x=>x.kind==='failed').length,1);
  assert.equal(filterDashboardProjects(data.projects,'cur','qa2').length,1);
  assert.equal(filterDashboardProjects(data.projects,'moved','').length,0);
});

test('latest moved-out snapshot is frozen and a returned Project is not shown as currently moved out', () => {
  const move = (id: string, projectId: string, from: string, to: string, time: string, pass: number) => ({ id,projectId,actorEmail:'qa@example.com',createdAt:time,before:{sprintId:from,sprint:'Sprint old',year:2026,name:projectId},after:{sprintId:to,sprint:'Sprint next',year:2026,name:projectId,kind:'sprint_move',reason:'Carry over',moveSnapshot:{totalCases:5,pass,failed:1,skip:0,inProgress:0,notStart:4-pass,openDefects:2}} });
  const data=buildSprintDashboard({sprintId:'s1',projects:[project('Moved','s3'),project('Returned','s1')],team:[],assignments:[],stats:[],approvals:[],origins:[],moves:[move('a','Moved','s1','s2','2026-10-01T10:00:00Z',1),move('b','Moved','s1','s3','2026-10-02T10:00:00Z',2),move('c','Returned','s1','s2','2026-10-01T10:00:00Z',0)]});
  assert.equal(data.movedOut.length,1); assert.equal(data.movedOut[0].id,'b');
  assert.equal(data.movedOut[0].snapshot.pass,2); assert.equal(data.summary.projects,1);
  assert.equal(data.attention[0].kind,'unassigned');
});
