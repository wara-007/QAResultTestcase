import assert from 'node:assert/strict';
import test from 'node:test';
import {casesFromRows} from './testcase-rows';
import {resolveRegisterReferenceTargets,withResultReferenceIssues} from './register-result-references';
import {caseResultReferences,automaticSheetCaseIds} from './sheet-mapping-model';
import {parseStoredResults,serializeStoredResults} from './stored-results';
import {readResultReferenceLinks,needsReferenceLinkRefresh} from './result-reference-links';
import {registerResultSnapshotTargets} from './register-result-write-plan';
const url='https://example.sharepoint.com/sites/QA/proof.xlsx';
const header=['Test Case Id','Test Case Name','Status','Ref (Result Testing)'];
const input=()=>casesFromRows([header,['MRS-5359','External','PASSED','Sanity.xlsx'],['MRS-5445','Shared','PASSED',url]]);
test('external documents keep their URLs without inventing result tabs, missing-tab warnings or changing status',()=>{
 const cases=resolveRegisterReferenceTargets(input(),[],new Map([['D2',url]]));
 assert.deepEqual(cases.map(item=>item.status),['Pass','Pass']);
 for(const item of cases){assert.deepEqual(caseResultReferences(item),[]);assert.equal(item.resultReferenceLinks?.[0].url,url);}
 assert.ok(withResultReferenceIssues(cases,[]).every(item=>!item.importIssues?.length));
 assert.deepEqual(automaticSheetCaseIds('MRS-5359',cases),[]);
 assert.deepEqual(registerResultSnapshotTargets(cases,[]),[]);
 assert.equal(cases.length,2);
});
test('a Jira label matching a real tab preserves both the tab owner and the issue link',()=>{
 for(const jira of ['https://qa.atlassian.net/browse/MRS-5450','https://jira.example.com/jira/browse/MRS-5450']){
 const cases=resolveRegisterReferenceTargets(casesFromRows([header,['MRS-5450','Case','PASSED','MRS-5450']]),[{name:'MRS-5450'}],new Map([['D2',jira]]));
 assert.deepEqual(caseResultReferences(cases[0]),['MRS-5450']);assert.equal(cases[0].resultReferenceLinks?.[0].url,jira);
 }
});
test('standalone rows in step templates retain their Ref cell for hyperlink lookup',()=>{
 const rows=[['Test Case (TC ID)*','Test Case Name*','Step#*','Description Step*','Expected Result*','Status','Ref (Result Testing)'],['MRS-5359','Standalone','','','','PASSED','Sanity.xlsx']];
 const cases=resolveRegisterReferenceTargets(casesFromRows(rows),[],new Map([['G2',url]]));
 assert.equal(cases[0].resultReferenceLinks?.[0].url,url);assert.equal(cases[0].status,'Pass');
});
test('reference link metadata survives stored results and unsafe links are rejected',()=>{
 const item=resolveRegisterReferenceTargets(input(),[],new Map([['D2',url]]))[0];
 const stored=parseStoredResults(serializeStoredResults(item));assert.deepEqual(stored.resultReferenceLinks,item.resultReferenceLinks);
 assert.deepEqual(readResultReferenceLinks([{label:'bad',url:'javascript:alert(1)'},{label:'bad',url:'file:///etc/passwd'}]),[]);
 assert.equal(needsReferenceLinkRefresh(input()),true);assert.equal(needsReferenceLinkRefresh([item]),false);
});

test('old friendly Ref labels request link metadata once, even when their hidden URL is unknown',()=>{
 const item=casesFromRows([header,['MRS-5450','Case','PASSED','MRS-5450']])[0];
 assert.equal(needsReferenceLinkRefresh([item]),true);
 assert.equal(needsReferenceLinkRefresh([{...item,resultReferenceLinks:[]}]),false);
});
