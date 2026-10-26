import assert from 'node:assert/strict';
import test from 'node:test';
import {casesFromRows} from './testcase-rows';
import {assignRegisterCaseIdentities, alignRegisterCaseIdentities, displayTestCaseId} from './register-case-identity';
const rows = () => casesFromRows([['Testcase ID','Test Case Name','Ref (Result Testing)'],['TC01','First definition','Proof A'],['TC01','Second definition','Proof B'],['TC02','Unique','Proof A']]);
test('each repeated register row gets a separate key while Sheet IDs and legacy last-row ID remain intact', () => {
  const result=assignRegisterCaseIdentities(rows());
  assert.equal(result.length,3);assert.equal(new Set(result.map(c=>c.id)).size,3);
  assert.equal(result[1].id,'TC01');assert.equal(result[2].id,'TC02');
  assert.deepEqual(result.map(displayTestCaseId),['TC01','TC01','TC02']);
});
test('row keys survive inserted rows, changed execution status, Ref edits and reordered source rows after alignment', () => {
  const before=assignRegisterCaseIdentities(rows());
  const reordered=rows().reverse().map(c=>({...c,sourceRow:c.sourceRow+10,status:'Pass' as const,resultReference:'Updated tab',sourceFields:c.sourceFields?.map(f=>f.field==='resultReference'?{...f,value:'Updated tab'}:f)}));
  const after=alignRegisterCaseIdentities(before,assignRegisterCaseIdentities(reordered));
  for(const c of before)assert.equal(after.find(n=>n.name===c.name)?.id,c.id);
});
test('identical duplicate rows are also separate cases', () => {
  const original=rows()[0];const cases=assignRegisterCaseIdentities([original,{...original,sourceRow:3}]);
  assert.equal(new Set(cases.map(c=>c.id)).size,2);
});
test('adding a duplicate does not steal the existing case record or link', () => {
  const local=assignRegisterCaseIdentities(rows().slice(0,1));
  const remote=alignRegisterCaseIdentities(local,assignRegisterCaseIdentities(rows().slice(0,2)));
  assert.equal(remote[0].id,'TC01');assert.notEqual(remote[1].id,'TC01');
});

test('an edited unique definition preserves its original persisted key',()=>{
 const local=assignRegisterCaseIdentities(rows().slice(0,1));
 const remote=alignRegisterCaseIdentities(local,rows().slice(0,1).map(c=>({...c,name:'Edited',sourceFields:undefined})));
 assert.equal(remote[0].id,local[0].id);
});

test('assigning already identified rows twice is idempotent',()=>{
 const first=assignRegisterCaseIdentities(rows());
 assert.deepEqual(assignRegisterCaseIdentities(first),first);
});

test('duplicate Step case IDs retain their QA identity when reordered by different step descriptions',()=>{
 const stepRows=(descriptions:string[])=>casesFromRows([['Test Scenario*','Test Case (TC ID)*','Test Case Name*','Step#*','Description Step*','Expected Result*'],...descriptions.map(description=>['TS01','TC01','Same name','Step1',description,'Works'])]);
 const before=assignRegisterCaseIdentities(stepRows(['First','Second']));
 const after=alignRegisterCaseIdentities(before,assignRegisterCaseIdentities(stepRows(['Second','First'])));
 assert.equal(before.length,2);
 for(const item of before)assert.equal(after.find(row=>row.steps===item.steps)?.id,item.id);
});

const duplicateDefinitions = (refs: string[]) => casesFromRows([
 ['Testcase ID', 'Test Case Name', 'Ref (Result Testing)'],
 ...refs.map(ref => ['TC01', 'Same definition', ref]),
]);

test('reordering identical definitions preserves the case URL and QA result owner through distinct raw Refs', () => {
 const before = assignRegisterCaseIdentities(duplicateDefinitions(['Proof A', 'Proof B']));
 const resultsById = new Map([[before[0].id, 'QA result for Proof A'], [before[1].id, 'QA result for Proof B']]);
 const after = alignRegisterCaseIdentities(before, duplicateDefinitions(['Proof B', 'Proof A']));
 assert.deepEqual(after.map(row => row.id), [before[1].id, before[0].id]);
 assert.deepEqual(after.map(row => resultsById.get(row.id)), ['QA result for Proof B', 'QA result for Proof A']);
});

test('resolved exact targets distinguish duplicate definitions even when their raw Ref labels match', () => {
 const cases = duplicateDefinitions(['Open proof', 'Open proof']).map((row, index) => ({
  ...row, resultReferenceTargets: [index === 0 ? 'Proof_A' : 'Proof-A'],
 }));
 const before = assignRegisterCaseIdentities(cases);
 const after = alignRegisterCaseIdentities(before, [...cases].reverse().map((row, index) => ({...row, sourceRow: index + 2})));
 assert.deepEqual(after.map(row => row.id), [before[1].id, before[0].id]);
});

test('matching an unchanged Ref first leaves the other duplicate identity available for a Ref edit', () => {
 const before = assignRegisterCaseIdentities(duplicateDefinitions(['Proof A', 'Proof B']));
 const after = alignRegisterCaseIdentities(before, duplicateDefinitions(['Edited proof', 'Proof A']));
 assert.deepEqual(after.map(row => row.id), [before[1].id, before[0].id]);
 assert.equal(new Set(after.map(row => row.id)).size, 2);
});

test('a distinct unchanged Ref preserves the URL when its duplicate definition is renamed and reordered', () => {
 const before = assignRegisterCaseIdentities(duplicateDefinitions(['Proof A', 'Proof B']));
 const incoming = casesFromRows([
  ['Testcase ID', 'Test Case Name', 'Ref (Result Testing)'],
  ['TC01', 'Edited definition', 'Proof B'],
  ['TC01', 'Same definition', 'Proof A'],
 ]);
 const after = alignRegisterCaseIdentities(before, incoming);
 assert.deepEqual(after.map(row => row.id), [before[1].id, before[0].id]);
});

test('exchanging Refs preserves distinct definition owners with or without a row reorder', () => {
 const before = assignRegisterCaseIdentities(rows().slice(0, 2));
 const resultsById = new Map(before.map(row => [row.id, `QA result for ${row.name}`]));
 const edited = rows().slice(0, 2).map((row, index) => ({...row, resultReference: index === 0 ? 'Proof B' : 'Proof A'}));
 for (const incoming of [edited, [...edited].reverse()]) {
  const after = alignRegisterCaseIdentities(before, incoming);
  for (const row of after) {
   assert.equal(row.id, before.find(saved => saved.name === row.name)?.id);
   assert.equal(resultsById.get(row.id), `QA result for ${row.name}`);
  }
  assert.equal(new Set(after.map(row => row.id)).size, 2);
 }
});

test('new identical rows receive unused occurrences and alignment remains idempotent after reorder',()=>{
 const before=assignRegisterCaseIdentities(duplicateDefinitions(['Proof A','Proof B']));
 const after=alignRegisterCaseIdentities(before,duplicateDefinitions(['Proof C','Proof B','Proof A']));
 assert.equal(new Set(after.map(item=>item.registerIdentity?.occurrence)).size,3);
 for(const original of before)assert.deepEqual(after.find(item=>item.resultReference===original.resultReference)?.registerIdentity,original.registerIdentity);
 assert.deepEqual(assignRegisterCaseIdentities(after),after);
 const again=alignRegisterCaseIdentities(after,duplicateDefinitions(['Proof A','Proof C','Proof B']));
 for(const item of again){const saved=after.find(previous=>previous.resultReference===item.resultReference)!;assert.equal(item.id,saved.id);assert.deepEqual(item.registerIdentity,saved.registerIdentity);}
});
