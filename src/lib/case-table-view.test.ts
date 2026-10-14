import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCaseColumns, caseColumnValue, filterCaseTable, visibleCaseColumns, parseCaseTableView, caseTableStorageKey, caseRegisterIdLabel } from './case-table-view';
import type { TestCase } from './types';
import { casesFromRows } from './testcase-rows';

const base:TestCase={id:'',name:'',sourceRow:1,platform:'',condition:'',scenario:'',steps:'',expected:'',status:'Not Start',device:'',testData:'',appVersion:'',environment:'',resultReference:'',executedBy:'',executedDate:'',executedTime:'',remark:'',evidence:[]};
const cases:TestCase[]=[{...base,
  id:'TC-01',name:'First',status:'Pass',device:'iOS',scenario:'Buy',sourceFields:[
    {column:0,label:'Test Case Id',value:'TC-01',field:'id'},
    {column:1,label:'Condition*',value:'Original',field:'condition'},
    {column:2,label:'Custom QA',value:'Blue'},
    {column:3,label:'Custom QA',value:''},
  ],condition:'Edited',customFields:[],
},{...base,id:'TC-02',name:'Second',status:'Skip',device:'Android',scenario:'Buy',sourceFields:[
  {column:0,label:'Test Case Id',value:'TC-02',field:'id'},
  {column:4,label:'Only second row',value:'Special'},
]}];

test('register ID uses the main case ID followed by the actual result tab, including identical names',()=>{
  assert.equal(caseRegisterIdLabel('TC01','',['TC01']),'TC01 (TC01)');
  assert.equal(caseRegisterIdLabel('TC02','TC01, TC02, TC03, TC04',['TC01, TC02, TC03, TC04']),'TC02 (TC01, TC02, TC03, TC04)');
  assert.equal(caseRegisterIdLabel('TC18','RC TC-18',['RC TC-18']),'TC18 (RC TC-18)');
  assert.equal(caseRegisterIdLabel('TC01','',['tc01']),'TC01 (tc01)');
  assert.equal(caseRegisterIdLabel('TC18','',[]),'TC18');
  assert.equal(caseRegisterIdLabel('TC18','',['TC19']),'TC18');
});

test('the original Status column in a step register displays and filters the case status rather than Step text',()=>{
  const headers=['Test Case (TC ID)*','Test Case Name*','Step#*','Description Step*','Expected Result* FN','Status'];
  const items=casesFromRows([headers,
    ['TAC_01_TC_01','Check terms','step 01 Login','Login','Success','PASSED'],
    ['','','step 02 Usage','Usage','Correct','Skip'],
    ['TAC_02_TC_02','Check terms','step 01 Login','Login','Success','Not Start'],
  ]);
  const columns=collectCaseColumns(items);
  const status=columns.find(column=>column.label==='Status' && column.column===5)!;
  assert.equal(caseColumnValue(items[0],status),'Pass');
  assert.equal(status.field,'status');
  assert.equal(columns.filter(column=>column.field==='status').length,1);
  assert.equal(caseColumnValue({...items[0],status:'Failed'},status),'Failed');
  assert.deepEqual(filterCaseTable(items,columns,{query:'',status:'All',selected:[],filters:[{column:status.key,operator:'equals',value:'Pass'}]}).map(item=>item.id),['TAC_01_TC_01']);
});

test('repeated Spint values show the source value once without unrelated Step names',()=>{
  const headers=['Test Scenario*','Test Scenario Description*','Test Case (TC ID)*','Test Case Name*','Positive/Negative Case*','Step#*','Description Step*','Expected Result* FN','Status','Device','Env','App V.','Ref (Result Testing)','Executed By','Executed Date','Spint'];
  const item=casesFromRows([headers,
    ['TAC_02','Verify True Prepaid','TAC_02_TC_02','Check terms','Positive','step 01 Login','Login','Success','Pass','Android','UAT','1.0','','QA','','Sprint 67'],
    ['','','','','Positive','step 02 Click usage','Click usage','Correct usage','Pass','Android','UAT','1.0','','QA','','Sprint 67'],
  ])[0];
  assert.ok(item);
  const columns=collectCaseColumns([item]);
  const sprint=columns.find(column=>column.label==='Spint')!;
  assert.equal(caseColumnValue(item,sprint),'Sprint 67');
  assert.equal(caseColumnValue(item,columns.find(column=>column.label==='Step#*')!),'step 01 Login\nstep 02 Click usage');
  assert.equal(filterCaseTable([item],columns,{query:'',status:'All',selected:[],filters:[{column:sprint.key,operator:'equals',value:'Sprint 67'}]}).length,1);
});

test('step-based registers expose every original header and keep values grouped by Step',()=>{
  const item={...base,id:'TC-step',stepDefinitions:[
    {id:'s1',name:'Step 01',sourceFields:[{ref:'F2',column:5,label:'Support*',value:'iOS',mapped:false}]},
    {id:'s2',name:'Step 02',sourceFields:[{ref:'F3',column:5,label:'Support*',value:'Android',mapped:false}]},
  ]} as TestCase;
  const column=collectCaseColumns([item]).find(c=>c.label==='Support*');
  assert.ok(column);
  assert.equal(caseColumnValue(item,column),'Step 01: iOS\nStep 02: Android');
});

test('all source columns including empty, duplicate and later-row headers are selectable',()=>{
  const columns=collectCaseColumns(cases);
  assert.equal(columns.filter(c=>c.label==='Custom QA').length,2);
  assert.ok(columns.some(c=>c.label==='Only second row'));
  const condition=columns.find(c=>c.label==='Condition*')!;
  assert.equal(caseColumnValue(cases[0],condition),'Edited');
  assert.equal(caseColumnValue(cases[1],columns.find(c=>c.label==='Custom QA')!),'');
});
test('ID is always visible and selected columns cannot exceed six',()=>{
  const columns=collectCaseColumns(cases);
  const selected=visibleCaseColumns(columns,columns.map(c=>c.key));
  assert.equal(selected.length,6);assert.equal(selected[0].field,'id');
  assert.deepEqual(visibleCaseColumns(columns,[]).map(c=>c.field),['id']);
});
test('filters combine with status and search including hidden source columns',()=>{
  const columns=collectCaseColumns(cases);
  const custom=columns.find(c=>c.label==='Custom QA')!;
  const view={query:'first',status:'Pass',filters:[{column:custom.key,operator:'equals',value:'blue'}],selected:[]} as const;
  assert.deepEqual(filterCaseTable(cases,columns,{...view,filters:[...view.filters],selected:[]}).map(c=>c.id),['TC-01']);
  assert.equal(filterCaseTable(cases,columns,{...view,status:'Skip',filters:[...view.filters],selected:[]}).length,0);
  assert.deepEqual(filterCaseTable(cases,columns,{query:'',status:'All',selected:[],filters:[{column:custom.key,operator:'empty',value:''}]}).map(c=>c.id),['TC-02']);
});
test('temporarily hidden advanced filters do not invisibly exclude rows but search and status still apply',()=>{
  const columns=collectCaseColumns(cases);
  const custom=columns.find(column=>column.label==='Custom QA')!;
  const view:import('./case-table-view').CaseTableView={query:'first',status:'Pass',selected:[],filters:[{column:custom.key,operator:'equals',value:'no match'}]};
  assert.deepEqual(filterCaseTable(cases,columns,view,false).map(item=>item.id),['TC-01']);
  assert.deepEqual(filterCaseTable(cases,columns,{...view,status:'Skip'},false),[]);
});
test('corrupt or obsolete preferences are handled safely without losing valid saved filters',()=>{
  assert.equal(parseCaseTableView('{bad').status,'All');
  const view=parseCaseTableView(JSON.stringify({version:1,query:'Hello',status:'Skip',selected:['id','id','x'],filters:[{column:'x',operator:'equals',value:'A'},{column:'x',operator:'invalid',value:'B'}]}));
  assert.equal(view.status,'Skip');assert.equal(view.filters.length,1);
  assert.deepEqual(view.selected,['id','x']);
  assert.notEqual(caseTableStorageKey('u1','p1'),caseTableStorageKey('u2','p1'));
  assert.notEqual(caseTableStorageKey('u1','p1'),caseTableStorageKey('u1','p2'));
});
