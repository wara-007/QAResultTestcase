import assert from 'node:assert/strict';
import test from 'node:test';
import { casesFromRows } from './testcase-rows';
import { assignRegisterCaseIdentities, displayTestCaseId } from './register-case-identity';
import { registerResultSnapshotTargets } from './register-result-write-plan';
test('duplicate register rows append independent snapshots to their shared Ref without overwriting each other',()=>{
 const cases=assignRegisterCaseIdentities(casesFromRows([['Testcase ID','Test Case Name','Ref (Result Testing)'],['TC01','First','Proof'],['TC01','Second','Proof']]));
 const plan=registerResultSnapshotTargets(cases,[{name:'Proof',rowCount:20}]);
 assert.deepEqual(plan.map(p=>p.name),['Proof','Proof']);
 assert.equal(plan[0].startRow,21);assert.equal(plan[1].startRow,23);
 assert.deepEqual(plan.map(p=>p.values[0][1]),cases.map(c=>c.id));
 assert.deepEqual(cases.map(displayTestCaseId),['TC01','TC01']);
});

test('shared Ref with distinct case IDs keeps one destination and register source columns',async()=>{
 const {buildRegisterExecutionWritePlan}=await import('./register-result-write-plan');
 const rows=[['Testcase ID','Ref (Result Testing)','Test Case Name','Status'],['TC01','Proof','First','Not Start'],['TC02','Proof','Second','Not Start']];
 const cases=assignRegisterCaseIdentities(casesFromRows(rows)).map(c=>({...c,status:'Pass' as const}));
 assert.deepEqual(registerResultSnapshotTargets(cases,[{name:'Proof',rowCount:20}]).map(p=>p.name),['Proof','Proof']);
 assert.deepEqual(buildRegisterExecutionWritePlan(cases,rows),[{range:"'Testcase'!D2",values:[['Pass']]},{range:"'Testcase'!D3",values:[['Pass']]}]);
 assert.throws(()=>buildRegisterExecutionWritePlan(cases,[rows[0],rows[2],rows[1]]),/เปลี่ยน/);
});

test('exact resolved Ref retains punctuation and normalized ambiguity is rejected', async () => {
 const {resolveRegisterReferenceTargets}=await import('./register-result-references');
 const {resolveSheetAssociations}=await import('./sheet-mapping-resolution');
 const sheets=['Proof_A','Proof-A'].map((name,index)=>({name,sheetId:index,path:String(index),order:index,kind:'result' as const,testCaseIds:[],imageCount:0,hidden:false,rowCount:20}));
 const cases=resolveRegisterReferenceTargets(casesFromRows([['Testcase ID','Test Case Name','Ref (Result Testing)'],['TC01','First','proof']]),sheets,new Map([['C2',"'Proof-A'!A1"]]));
 assert.deepEqual(resolveSheetAssociations(sheets,cases,[]).associations.map(item=>item.sheet.name),['Proof-A']);
 assert.equal(registerResultSnapshotTargets(cases,sheets)[0].name,'Proof-A');
 const ambiguous=cases.map(item=>({...item,resultReferenceTargets:['Proof A']}));
 assert.deepEqual(resolveSheetAssociations(sheets,ambiguous,[]).associations,[]);
 assert.throws(()=>registerResultSnapshotTargets(ambiguous,sheets),/กำกวม|ambiguous/);
});

test('master custom field edits write the original cell without replacing definitions or formulas', async () => {
 const {buildRegisterExecutionWritePlan}=await import('./register-result-write-plan');
 const rows=[['Testcase ID','Extra','Ref (Result Testing)','Status'],['TC01','original','Proof','Not Start']];
 const cases=casesFromRows(rows);
 cases[0].customFields![0].value='edited';
 assert.ok(buildRegisterExecutionWritePlan(cases,rows).some(write=>write.range==="'Testcase'!B2" && write.values[0][0]==='edited'));
});

test('ordinary register Test data edits sync to their source cell while formulas stay intact', async () => {
 const {buildRegisterExecutionWritePlan}=await import('./register-result-write-plan');
 const rows=[['Testcase ID','Test Data','Ref (Result Testing)','Status'],['TC01','original','Proof','Not Start']];
 const cases=casesFromRows(rows);
 cases[0].testData='edited';
 assert.deepEqual(buildRegisterExecutionWritePlan(cases,rows),[
  {range:"'Testcase'!B2",values:[['edited']]},
  {range:"'Testcase'!D2",values:[['Not Start']]},
 ]);
 assert.deepEqual(buildRegisterExecutionWritePlan(cases,[rows[0],['TC01','=A2','Proof','Not Start']]),[
  {range:"'Testcase'!D2",values:[['Not Start']]},
 ]);
});
