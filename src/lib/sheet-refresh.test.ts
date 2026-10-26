import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetRefreshRequired, isRegisterBaseline, registerBaseline, refreshRegisterCases, withWorkbookDefinitions, withSavedCaseIdentity } from './sheet-refresh';
import { checkpointSheetImport, readSheetImportState } from './sheet-import-state';
import type { TestCase } from './types';
import { casesFromRows } from './testcase-rows';
import { parseStoredResults, serializeStoredResults } from './stored-results';
const item = (name: string): TestCase => ({ id:'TC_01', name, sourceRow:2, platform:'', condition:'', scenario:'', steps:'', expected:'', status:'Not Start', device:'', testData:'', appVersion:'', environment:'', resultReference:'', executedBy:'', executedDate:'', executedTime:'', remark:'', evidence:[], results:[], defects:[], persistedLocally:true });
test('only a known matching source revision avoids fresh import', () => {
 assert.equal(sheetRefreshRequired(undefined,'2'),true);
 assert.equal(sheetRefreshRequired({sourceRevision:'1'},'2'),true);
 assert.equal(sheetRefreshRequired({sourceRevision:'2'},'2'),false);
 assert.equal(sheetRefreshRequired({sourceRevision:'2',refreshRequired:true},'2'),true);
});
test('revision and register baseline survive source checkpoint serialization', () => {
 const saved = {...checkpointSheetImport(undefined,'sheet',{},'2026-10-24T00:00:00Z',false),sourceRevision:'12',registerBaseline:registerBaseline([item('old')])};
 const restored=readSheetImportState(JSON.parse(JSON.stringify(saved)),'sheet')!;
 const next=checkpointSheetImport(restored,'sheet',{A:'loaded'},'2026-10-24T00:01:00Z',true);
 assert.equal(next.sourceRevision,'12');
 assert.deepEqual(next.registerBaseline,saved.registerBaseline);
});
test('fresh source metadata replaces stored imports while preserving QA result and evidence', () => {
 const local=item('old'); local.results=[{id:'WEB-1',source:'web',status:'Pass',actualResult:'QA notes',apiResponse:'',log:'',evidence:[],createdAt:''}];
 const result=refreshRegisterCases([local],[item('new')]);
 assert.equal(result.cases[0].name,'new');
 assert.equal(result.cases[0].results?.[0].actualResult,'QA notes');
 assert.equal(result.conflicts.length,0);
});
test('Sheets wins local-only and simultaneous metadata changes without conflicts', () => {
 assert.equal(refreshRegisterCases([item('QA edit')],[item('original')]).cases[0].name,'original');
 const both=refreshRegisterCases([item('QA edit')],[item('Sheets edit')]);
 assert.equal(both.conflicts.length,0);
 assert.equal(both.cases[0].name,'Sheets edit');
});
test('legacy imports trust Sheets status while preserving authored results', () => {
 const local=item('old');local.status='Pass';local.results=[{id:'WEB-1',source:'web',status:'Pass',actualResult:'QA',apiResponse:'',log:'',evidence:[],createdAt:''}];
 const result=refreshRegisterCases([local],[item('new')]);
 assert.equal(result.cases[0].name,'new');assert.equal(result.cases[0].status,'Not Start');assert.equal(result.conflicts.length,0);
 assert.equal(result.cases[0].results?.[0].actualResult,'QA');
});
test('first revision check uses Sheets definitions and status without requiring an old baseline', () => {
 const local=item('QA edited name');local.status='Pass';
 const result=refreshRegisterCases([local],[item('Sheets name')]);
 assert.equal(result.cases[0].name,'Sheets name');assert.equal(result.cases[0].status,'Not Start');
 assert.equal(result.conflicts.length,0);
});
test('a Sheets edit during import leaves the captured revision incomplete and requires a fresh workbook', async () => {
 const { sheetImportRevisionStatus } = await import('./sheet-refresh');
 assert.deepEqual(sheetImportRevisionStatus('12','13',true),{complete:false,refreshRequired:true});
 assert.deepEqual(sheetImportRevisionStatus('12','12',true),{complete:true,refreshRequired:false});
 assert.deepEqual(sheetImportRevisionStatus('12','12',false),{complete:false,refreshRequired:false});
});
test('all conflicting cases use Sheets automatically', () => {
 const a=item('A'),b={...item('B'),id:'TC_02'};
 const result=refreshRegisterCases([{...a,name:'QA A'},{...b,name:'QA B'}],[{...a,name:'Sheet A'},{...b,name:'Sheet B'}]);
 assert.deepEqual(result.conflicts,[]);
 assert.equal(result.cases[0].name,'Sheet A');
 assert.equal(result.cases[1].name,'Sheet B');
});
test('source refresh updates status, clears removed text and follows reordered rows', () => {
 const before=item('case');before.remark='old note';
 const remote={...before,status:'Pass' as const,remark:'',sourceRow:12};
 const refreshed=refreshRegisterCases([before],[remote,{...item('new case'),id:'TC_02'}]);
 assert.equal(refreshed.cases[0].status,'Pass');assert.equal(refreshed.cases[0].remark,'');assert.equal(refreshed.cases[0].sourceRow,12);
 assert.equal(refreshed.cases.length,2);
});
test('workbook step definitions complete sparse register responses before conflict detection', async () => {
 const { withWorkbookDefinitions }=await import('./sheet-refresh');
 const stored=item('case');stored.steps='Step1\nOpen app';stored.expected='App opened';
 const workbook={...stored,stepDefinitions:[{id:'step-1',name:'Step1',description:'Open app',expected:'App opened'}]} as TestCase;
 const fresh=withWorkbookDefinitions([item('case')],[workbook]);
 const result=refreshRegisterCases([stored],fresh);
 assert.equal(result.conflicts.length,0);assert.equal(result.cases[0].steps,stored.steps);
});
test('blank Sheets instructions clear old instructions even on a legacy import', () => {
 const stored=item('case');stored.steps='Step1\nOpen app';stored.expected='App opened';
 const refreshed=refreshRegisterCases([stored],[item('case')]);
 assert.equal(refreshed.conflicts.length,0);
 assert.equal(refreshed.cases[0].steps,'');assert.equal(refreshed.cases[0].expected,'');
});
test('Sheets replaces step definitions and source warnings without losing saved evidence or local-only cases', () => {
 const evidence={fileId:'saved-proof',name:'proof.png',mimeType:'image/png'};
 const header=['Test Case (TC ID)','Step#','Description Step','Expected Result','Status'];
 const local={...casesFromRows([header,['TC_01','Step1','Old instruction','Old expected','Pass']])[0],importIssues:['Step1: เก็บข้อมูลเดิมไว้'],evidence:[evidence]};
 local.results=[{id:'WEB-1',source:'web',status:'Pass',stepId:local.stepDefinitions![0].id,actualResult:'QA notes',apiResponse:'',log:'',evidence:[evidence],createdAt:''}];
 const remote=casesFromRows([header,['TC_01','Step1','New instruction','New expected','NotStart']])[0];
 const localOnly={...item('Web-only'),id:'TC_99'};
 const result=refreshRegisterCases([local,localOnly],[remote]);
 assert.equal(result.cases[0].stepDefinitions?.[0].description,'New instruction');
 assert.deepEqual(result.cases[0].importIssues,[]);
 assert.deepEqual(result.cases[0].results?.[0].evidence,[evidence]);
 assert.deepEqual(result.cases[0].evidence,[evidence]);
 assert.equal(result.cases[0].results?.[0].actualResult,'QA notes');
 assert.equal(result.cases[1].name,'Web-only');
});
test('a resumed partial save keeps step references intact if the full workbook later fails', () => {
 const header=['Test Case (TC ID)','Step#','Description Step','Expected Result','Status'];
 const stored=casesFromRows([header,['TC_01','Step1','Open app','App opens','Pass']])[0];
 const evidence={fileId:'proof',name:'proof.png',mimeType:'image/png'};
 stored.results=[{id:'WEB-1',source:'web',stepId:stored.stepDefinitions![0].id,status:'Pass',actualResult:'QA notes',apiResponse:'',log:'',evidence:[evidence],createdAt:''}];
 const partial=refreshRegisterCases([stored],[item('Latest name')],{definitionsReady:false}).cases[0];
 assert.equal(partial.name,'Latest name'); assert.equal(partial.steps,stored.steps); assert.equal(partial.expected,stored.expected);
 // This snapshot is the durable state if a subsequent workbook request fails.
 const saved=parseStoredResults(serializeStoredResults(partial));
 assert.equal(saved.stepDefinitions?.[0].id,saved.results[0].stepId);
 assert.deepEqual(saved.results[0].evidence,[evidence]);
 const complete=refreshRegisterCases([partial],[item('Latest name')]).cases[0];
 assert.equal(complete.stepDefinitions,undefined); assert.equal(complete.steps,'');
});
test('partial persistence identities cannot turn saved step definitions into source data', () => {
 const header=['Test Case (TC ID)','Step#','Description Step','Expected Result','Status'];
 const stored=casesFromRows([header,['TC_01','Step1','Old instruction','Old expected','Pass']])[0];
 stored.persistedLocally=true;
 const remote=item('Latest name');
 const saved={...refreshRegisterCases([stored],[remote],{definitionsReady:false}).cases[0],recordId:'saved-case',executionId:'saved-execution'};
 const source=withSavedCaseIdentity(remote,saved);
 assert.equal(source.recordId,'saved-case'); assert.equal(source.stepDefinitions,undefined); assert.equal(source.steps,'');
 const workbook=casesFromRows([header,['TC_01','Step1','Latest instruction','Latest expected','Pass']]);
 const complete=refreshRegisterCases([saved],withWorkbookDefinitions([source],workbook)).cases[0];
 assert.equal(complete.stepDefinitions?.[0].description,'Latest instruction');
 assert.equal(complete.expected,workbook[0].expected);
});

for(const count of [2000,2001,10000]) test(`a complete ${count}-case baseline survives the final checkpoint without truncation`,()=>{
 const baseline=registerBaseline(Array.from({length:count},(_,i)=>({...item(`Case ${i}`),id:`TC_${i+1}`})));
 assert.equal(isRegisterBaseline(baseline),true);
 const saved={...checkpointSheetImport(undefined,'sheet',{},'2026-10-26T00:00:00Z',true),registerBaseline:baseline};
 const restored=readSheetImportState(JSON.parse(JSON.stringify(saved)),'sheet');
 assert.equal(restored?.complete,true);
 assert.equal(Object.keys(restored!.registerBaseline!).length,count);
 assert.equal(restored!.registerBaseline![Object.keys(baseline).at(-1)!]?.name,`Case ${count-1}`);
});

test('large baselines still validate every row rather than accepting malformed trailing data',()=>{
 const baseline=registerBaseline(Array.from({length:2001},(_,i)=>({...item('Case'),id:`TC_${i+1}`})));
 assert.equal(isRegisterBaseline({...baseline,TC_BAD:{name:123}}),false);
 assert.equal(isRegisterBaseline({...baseline,TC_BAD:{unexpected:'field'}}),false);
 assert.equal(isRegisterBaseline({...baseline,TC_BAD:['not a record']}),false);
});

test('refresh resumes an incomplete matching revision instead of leaving queued tabs stranded', async()=>{
 const { automaticSheetImportMode } = await import('./sheet-refresh');
 assert.equal(automaticSheetImportMode({sourceRevision:'same',complete:false},'same'),'resume');
 assert.equal(automaticSheetImportMode({sourceRevision:'same',complete:true},'same'),null);
 assert.equal(automaticSheetImportMode({sourceRevision:'old',complete:false},'new'),'fresh');
 assert.equal(automaticSheetImportMode({sourceRevision:'same',complete:false,refreshRequired:true},'same'),'fresh');
 assert.equal(automaticSheetImportMode(undefined,'new'),'fresh');
});
