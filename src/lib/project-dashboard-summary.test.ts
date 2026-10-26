import assert from 'node:assert/strict';
import test from 'node:test';
import {casesFromRows} from './testcase-rows';
import {buildProjectDashboardCounts,readProjectDashboardSummary,isProjectDashboardCounts,mergeProjectDashboardSummary} from './project-dashboard-summary';
const counts={totalCases:2,pass:1,failed:0,skip:1,inProgress:0,notStart:0,openDefects:1,totalDefects:2,closedDefects:1};
test('cached counts preserve independent register rows, exclude sheet-only snapshots, and respect defect register precedence',()=>{
 const cases=casesFromRows([['Test Case Id','Test Case Name'],['TC01','First'],['TC01','Second']]);
 cases[0].status='Pass';cases[1].status='Skip';
 const defect=(id:string,status:string,jiraUrl='')=>({id,status,jiraUrl,title:id,description:'',apiResponse:'',log:'',createdAt:'',evidence:[]});
 cases[0].defects=[defect('D1','Open','https://jira/D1')];
 const snapshot={...cases[0],id:'Extra',sourceRow:0,sourceSheetName:'Proof',defects:[]};
 const actual=buildProjectDashboardCounts([...cases,snapshot],[{name:'Defect',defects:[defect('D2','Closed','https://jira/D1'),defect('D3','Open')]}]);
 assert.deepEqual(actual,counts);
});
test('summary validation rejects inconsistent, negative, missing, or foreign-source snapshots',()=>{
 const summary={version:1 as const,sourceId:'source',token:'token',updatedAt:'2026-10-26T00:00:00Z',importComplete:true,counts};
 assert.equal(readProjectDashboardSummary(summary,'source')?.counts.totalCases,2);
 assert.equal(readProjectDashboardSummary(summary,'other'),undefined);
 for(const invalid of [{...counts,pass:-1},{...counts,totalCases:99},{...counts,closedDefects:99},{...counts,pass:NaN},{}])assert.equal(isProjectDashboardCounts(invalid),false);
 assert.equal(readProjectDashboardSummary({...summary,updatedAt:'invalid'}),undefined);
});
test('summary compare-and-swap rejects stale clients and preserves unrelated checkpoint metadata',()=>{
 const previous={version:1 as const,sourceId:'source',token:'old',updatedAt:'2026-10-26T00:00:00Z',importComplete:true,counts};
 const next={...previous,token:'new'};
 const mapping={sheetImport:{complete:true},coverSnapshot:{sheetName:'Cover'},dashboardSummary:previous};
 assert.throws(()=>mergeProjectDashboardSummary(mapping,next,null),/พร้อมกัน/);
 assert.throws(()=>mergeProjectDashboardSummary(mapping,next,'stale'),/พร้อมกัน/);
 const merged=mergeProjectDashboardSummary(mapping,next,'old');
 assert.equal(merged.sheetImport,mapping.sheetImport);assert.equal(merged.coverSnapshot,mapping.coverSnapshot);
 assert.equal(merged.dashboardSummary,next);
});
