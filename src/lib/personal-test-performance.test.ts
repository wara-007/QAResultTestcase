import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPersonalPerformance, type PersonalCase, type PersonalResult } from './personal-test-performance';

const members = [{userId:'a',name:'Ann',email:'ann@example.com',role:'qa'}, {userId:'b',name:'Ben',email:'ben@example.com',role:'qa'}];
const result = (id:string, testerName:string, status:string, order=1): PersonalResult => ({id,testerName,status,order,source:'web',sourceSheet:'',recordedAt:'',inferred:false,originSprintId:'s1'});
const row = (results:PersonalResult[]=[], assignedUserIds:string[]=[], sourceRowKey='base'): PersonalCase => ({projectId:'p',projectName:'Project',currentSprintId:'s1',caseId:'TC-18',caseName:'Checkout',sourceRowKey,detailPath:'/case',assignedUserIds,results});
const build = (cases:PersonalCase[], filters={}) => buildPersonalPerformance({sprintId:'s1',members,cases,filters});
test('Skip without EXECUTED BY stays unknown and does not create pending work for assigned QA', () => {
  const data = build([row([{ ...result('skip', '', 'Skip'), source: 'sheets', inferred: true }], ['a'])]);
  assert.equal(data.length, 1);
  assert.equal(data[0].key, 'unknown');
  assert.equal(data[0].name, 'ไม่ระบุผู้ทดสอบ');
  assert.equal(data[0].skip, 1);
  assert.equal(data[0].notStart, 0);
});

test('latest per-tester outcome replaces retests without merging separate source rows', () => {
  const data=build([row([result('r1','Ann','Failed',1),result('r2','Ann','Passed',2),result('r3','Ben','fail',3)]),row([result('r4','Ann','Pass')],[],'RC TC-18 broken')]);
  assert.equal(data.find(p=>p.key==='a')?.pass,2);
  assert.equal(data.find(p=>p.key==='a')?.tested,2);
  assert.equal(data.find(p=>p.key==='b')?.failed,1);
});
test('duplicate snapshots and invalid dates use stable order without inflating counts', () => {
  const data=build([row([{...result('r1','Ann','Failed',1),recordedAt:'bad'},result('r2','Ann','Pass',2),result('r2','Ann','Pass',2)])]);
  assert.equal(data[0].pass,1); assert.equal(data[0].entries.length,1);
});
test('valid dates select newest result regardless of array ordering', () => {
  const data=build([row([{...result('r1','Ann','Failed',10),recordedAt:'2026-01-01'}, {...result('r2','Ann','Pass',1),recordedAt:'2026-01-02'}])]);
  assert.equal(data[0].pass,1);
});
test('exact email resolves but ambiguous names stay unresolved and imports retain source notice', () => {
  const duplicate=[...members,{userId:'c',name:'Ann',email:'other@example.com',role:'qa'}];
  const data=buildPersonalPerformance({sprintId:'s1',members:duplicate,cases:[row([{...result('r1',' ANN@EXAMPLE.COM ','Pass'),source:'sheets',inferred:true},result('r2','Ann','Failed')])],filters:{}});
  assert.equal(data.find(p=>p.key==='a')?.pass,1);
  assert.equal(data.find(p=>p.key==='name:ann')?.failed,1);
  assert.equal(data.find(p=>p.key==='a')?.entries[0].inferred,true);
});
test('pending work is assigned per case, never copied from Project responsibility', () => {
  const data=build([row([],['a','b']),{...row(),caseId:'TC-19'}]);
  assert.equal(data.find(p=>p.key==='a')?.notStart,1);
  assert.equal(data.find(p=>p.key==='b')?.notStart,1);
  assert.equal(data.find(p=>p.key==='unassigned')?.notStart,1);
});
test('started result overrides pending for that person while another assignee remains pending', () => {
  const data=build([row([result('r1','Ann','Inprogress')],['a','b'])]);
  assert.equal(data.find(p=>p.key==='a')?.inProgress,1);
  assert.equal(data.find(p=>p.key==='a')?.notStart,0);
  assert.equal(data.find(p=>p.key==='b')?.notStart,1);
});
test('unassigned explicit Not Start is not a tested-person result', () => {
  const data=build([row([result('r1','Ann','Not Start')])]);
  assert.equal(data.find(p=>p.key==='unassigned')?.notStart,1);
  assert.equal(data.find(p=>p.key==='a'),undefined);
});
test('source/person/project filters constrain counts and drill-down entries', () => {
  const data=build([row([result('r1','Ann','Pass')]),row([{...result('r2','Ben','Skip'),source:'sheets'}],[],'detail')],{source:'sheets',testerKey:'b',projectId:'p'});
  assert.equal(data.length,1); assert.equal(data[0].skip,1);assert.equal(data[0].entries.length,1);
  assert.equal(build([row([result('r1','Ann','Pass')])],{projectId:'other'}).length,0);
});
test('moved-out known origins remain while inferred imports belong to current Sprint', () => {
  const moved={...row([{...result('r1','Ann','Pass')},{...result('r2','Ben','Failed'),inferred:true,source:'sheets'}]),currentSprintId:'s2'};
  const data=build([moved]);
  assert.equal(data.length,1);assert.equal(data[0].key,'a');assert.equal(data[0].pass,1);
});
