import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { buildStepSheetWritePlan, stepResultSnapshotRows, readStepResultSnapshots } from "./step-sheet-sync";

const rows = [["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status", "Device", "Env"], ["ENQ_01_TC_01", "step 08", "BE", "API", "TESTING", "iOS", "UAT"], ["", "step 08", "Legacy", "API", "Skip", "Android", "UAT"]];
test("Step sync changes only mapped execution cells and never replaces headers or merged definitions", () => {
  const testCase = casesFromRows(rows)[0];
  testCase.stepDefinitions![0].status = "Pass";
  testCase.stepDefinitions![1].status = "Blocked";
  const writes = buildStepSheetWritePlan([testCase], rows);
  assert.deepEqual(writes.map(write => write.range), ["'Testcase'!E2", "'Testcase'!F2", "'Testcase'!G2", "'Testcase'!E3", "'Testcase'!F3", "'Testcase'!G3"]);
  assert.deepEqual(writes.filter(write => write.range.startsWith("'Testcase'!E")).map(write => write.values), [[["Pass"]], [["Block"]]]);
});
test("sync rejects stale row ownership and leaves formula cells untouched", () => {
  const testCase = casesFromRows(rows)[0];
  const changed = rows.map(row => [...row]);
  changed[1][0] = "ANOTHER_TC";
  assert.throws(() => buildStepSheetWritePlan([testCase], changed), /เปลี่ยน/);
  const changedDefinition = rows.map(row => [...row]);
  changedDefinition[1][2] = "Replacement procedure";
  assert.throws(() => buildStepSheetWritePlan([testCase], changedDefinition), /เปลี่ยน/);
  const formulas = rows.map(row => [...row]);
  formulas[1][4] = '=IF(A2="","","TESTING")';
  assert.ok(!buildStepSheetWritePlan([testCase], formulas).some(write => write.range === "'Testcase'!E2"));
});
test("owned result snapshots preserve long text, Step ownership and evidence and newest snapshot wins", () => {
  const testCase = casesFromRows(rows)[0];
  testCase.results = [{ id: "web-result", source: "web", stepId: "Testcase:2", status: "Pass", actualResult: "Correct", apiResponse: "x".repeat(70000), log: "log", evidence: [{ fileId: "image", mimeType: "image/png", name: "proof" }], createdAt: "2026-10-06" }];
  const first = stepResultSnapshotRows(testCase);
  assert.ok(first.flat().every(value => value.length < 50000));
  testCase.results[0].actualResult = "Edited";
  const parsed = readStepResultSnapshots([...first, ...stepResultSnapshotRows(testCase)], testCase.id);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].actualResult, "Edited");
  assert.equal(parsed[0].apiResponse.length, 70000);
  assert.equal(parsed[0].stepId, "Testcase:2");
  assert.equal(parsed[0].evidence[0].fileId, "image");
});

test('snapshot register identity follows its owning duplicate after rows reorder',async()=>{
 const {casesFromRows}=await import('./testcase-rows');
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const rows=[['Testcase ID','Test Case Name'],['TC01','First'],['TC01','Second']];
 const before=assignRegisterCaseIdentities(casesFromRows(rows)).map((item,index)=>({...item,results:[{id:`QA-${index}`,source:'web' as const,status:'Pass' as const,actualResult:item.name,apiResponse:'',log:'',evidence:[],createdAt:''}]}));
 const snapshots=before.flatMap(stepResultSnapshotRows);
 const reordered=assignRegisterCaseIdentities(casesFromRows([rows[0],rows[2],rows[1]]));
 for(const item of reordered)assert.equal(readStepResultSnapshots(snapshots,item.id,item.registerIdentity)[0]?.actualResult,item.name);
 assert.deepEqual(readStepResultSnapshots([["QA Workspace Results v1","TC01"],["QA Result","old","","Pass"],["Actual result","Ambiguous"],["QA Workspace Results end","TC01"]],'TC01',undefined,false),[]);
});

test('unique cases retain saved snapshots after their definition is edited',async()=>{
 const {casesFromRows}=await import('./testcase-rows');
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const original=assignRegisterCaseIdentities(casesFromRows([['Testcase ID','Test Case Name'],['TC01','Original']]))[0];
 original.results=[{id:'QA-A',source:'web',status:'Pass',actualResult:'Retained',apiResponse:'',log:'',evidence:[],createdAt:''}];
 const edited=assignRegisterCaseIdentities(casesFromRows([['Testcase ID','Test Case Name'],['TC01','Edited']]))[0];
 assert.equal(readStepResultSnapshots(stepResultSnapshotRows(original),edited.id,edited.registerIdentity,true,true)[0]?.actualResult,'Retained');
});

test('owned case snapshot round trips defects and detail custom fields independently on a shared tab', async()=>{
 const {readStepCaseSnapshot}=await import('./step-sheet-sync');
 const item=casesFromRows([['Testcase ID','Test Case Name','Ref (Result Testing)'],['TC01','First','Proof']])[0];
 item.defects=[{id:'web-defect',status:'Open',title:'Broken',description:'x'.repeat(70000),apiResponse:'api',log:'log',jiraUrl:'https://jira.example/QA-1',createdAt:'2026-10-26',evidence:[{fileId:'proof',name:'image',mimeType:'image/png'}]}];
 item.customFields=[{key:'detail:extra',label:'Extra',value:'edited',source:'detail',sheetName:'Proof',row:2,column:1}];
 const other={...item,id:'TC02',defects:[],customFields:[]};
 const serialized=[...stepResultSnapshotRows(item),...stepResultSnapshotRows(other)];
 const restored=readStepCaseSnapshot(serialized,'TC01');
 assert.deepEqual(restored.defects,item.defects); assert.deepEqual(restored.customFields,item.customFields);
 assert.equal(readStepCaseSnapshot(serialized,'TC02').defects,undefined);
 assert.ok(serialized.flat().every(value=>value.length<50000));
});

test('aligned identical definitions retain their snapshot identity after distinct Ref reorder',async()=>{
 const {assignRegisterCaseIdentities,alignRegisterCaseIdentities}=await import('./register-case-identity');
 const header=['Testcase ID','Test Case Name','Ref (Result Testing)'];
 const make=(refs:string[])=>casesFromRows([header,...refs.map(ref=>['TC01','Same definition',ref])]);
 const before=assignRegisterCaseIdentities(make(['Proof A','Proof B']));
 before.forEach(item=>{item.results=[{id:item.resultReference,source:'web',status:'Pass',actualResult:item.resultReference,apiResponse:'',log:'',evidence:[],createdAt:''}];});
 const after=alignRegisterCaseIdentities(before,make(['Proof B','Proof A']));
 const snapshots=before.flatMap(stepResultSnapshotRows);
 for(const item of after){
  assert.equal(item.registerIdentity?.occurrence,before.find(old=>old.id===item.id)?.registerIdentity?.occurrence);
  assert.equal(readStepResultSnapshots(snapshots,item.id,item.registerIdentity,false,false)[0]?.actualResult,item.resultReference);
 }
});

test('reference-scoped snapshots read before alignment and reject ambiguous legacy occurrence matches',async()=>{
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const {snapshotOwnership}=await import('./step-sheet-sync');
 const header=['Testcase ID','Test Case Name','Ref (Result Testing)'];
 const make=(refs:string[])=>assignRegisterCaseIdentities(casesFromRows([header,...refs.map(ref=>['TC01','Same definition',ref])]).map(row=>({...row,resultReferenceTargets:[row.resultReference,'Shared']})));
 const before=make(['Proof A','Proof B']);
 before.forEach(item=>{item.results=[{id:item.resultReference,source:'web',status:'Pass',actualResult:item.resultReference,apiResponse:'',log:'',evidence:[],createdAt:''}];});
 const snapshots=before.flatMap(stepResultSnapshotRows);
 const incoming=make(['Proof B','Proof A']);
 for(const item of incoming){
  const context=snapshotOwnership(item,incoming,'Shared');
  assert.equal(readStepResultSnapshots(snapshots,item.id,item.registerIdentity,false,false,context)[0]?.actualResult,item.resultReference);
  const legacy=snapshots.map(row=>row[0]==='QA Workspace Results v1'?row.slice(0,3):row);
  assert.deepEqual(readStepResultSnapshots(legacy,item.id,item.registerIdentity,false,false,context),[]);
 }
});

test('snapshot definition ownership wins when distinct duplicate definitions exchange references',async()=>{
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const {snapshotOwnership}=await import('./step-sheet-sync');
 const header=['Testcase ID','Test Case Name','Ref (Result Testing)'];
 const before=assignRegisterCaseIdentities(casesFromRows([header,['TC01','First definition','Proof A'],['TC01','Second definition','Proof B']]));
 before.forEach(item=>{item.resultReferenceTargets=[item.resultReference,'Shared'];item.results=[{id:item.name,source:'web',status:'Pass',actualResult:item.name,apiResponse:'',log:'',evidence:[],createdAt:''}];});
 const incoming=assignRegisterCaseIdentities(casesFromRows([header,['TC01','Second definition','Proof A'],['TC01','First definition','Proof B']]));
 incoming.forEach(item=>{item.resultReferenceTargets=[item.resultReference,'Shared'];});
 for(const item of incoming){
  const context=snapshotOwnership(item,incoming,'Shared');
  const wrongTabSnapshot=stepResultSnapshotRows(before.find(row=>row.resultReference===item.resultReference)!);
  assert.deepEqual(readStepResultSnapshots(wrongTabSnapshot,item.id,item.registerIdentity,false,false,context),[]);
  assert.equal(readStepResultSnapshots(before.flatMap(stepResultSnapshotRows),item.id,item.registerIdentity,false,false,context)[0]?.actualResult,item.name);
 }
});

test('a Ref can retain a renamed snapshot when its old definition has no other current owner',async()=>{
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const {snapshotOwnership}=await import('./step-sheet-sync');
 const header=['Testcase ID','Test Case Name','Ref (Result Testing)'];
 const before=assignRegisterCaseIdentities(casesFromRows([header,['TC01','First','Proof A'],['TC01','Second','Proof B']]));
 before[1].results=[{id:'web',source:'web',status:'Pass',actualResult:'QA Second',apiResponse:'',log:'',evidence:[],createdAt:''}];
 const incoming=assignRegisterCaseIdentities(casesFromRows([header,['TC01','Renamed second','Proof B'],['TC01','First','Proof A']]));
 const renamed=incoming[0];
 assert.equal(readStepResultSnapshots(stepResultSnapshotRows(before[1]),renamed.id,renamed.registerIdentity,false,false,snapshotOwnership(renamed,incoming,'Proof B'))[0]?.actualResult,'QA Second');
});

test('a formerly shared legacy tab cannot transfer another duplicate snapshot to its remaining owner',async()=>{
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const {snapshotOwnership}=await import('./step-sheet-sync');
 const header=['Testcase ID','Test Case Name','Ref (Result Testing)'];
 const before=assignRegisterCaseIdentities(casesFromRows([header,['TC01','Same definition','Proof A'],['TC01','Same definition','Proof B']]));
 before.forEach(item=>{item.resultReferenceTargets=[item.resultReference,'Shared'];item.results=[{id:item.resultReference,source:'web',status:'Pass',actualResult:item.resultReference,apiResponse:'',log:'',evidence:[],createdAt:''}];});
 const legacy=before.flatMap(stepResultSnapshotRows).map(row=>row[0]==='QA Workspace Results v1'?row.slice(0,3):row);
 const incoming=before.map((item,index)=>({...item,resultReferenceTargets:index===0?['Proof A','Shared']:['Proof B']}));
 const owner=incoming[0];
 assert.deepEqual(readStepResultSnapshots(legacy,owner.id,owner.registerIdentity,false,false,snapshotOwnership(owner,incoming,'Shared')),[]);
});
