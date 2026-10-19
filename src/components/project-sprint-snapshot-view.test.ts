import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectSprintSnapshotView } from './project-sprint-snapshot-view';
import type { SnapshotHeader } from '../lib/project-sprint-participation';
const header:SnapshotHeader={version:1,participation:{id:'e',projectId:'p',sprintId:'67',snapshotKind:'legacy-summary',enteredAt:null,previousId:null,nextId:null,exitedAt:'2026-10-18T00:00:00Z',actorName:'qa@test',reason:'continue'},project:{id:'p',name:'Frozen',description:'old',environment:'UAT'},counts:{totalCases:4,pass:2,skip:1,failed:1,notStart:0,inProgress:0,openDefects:0},qa:[],approval:{projectId:'p',total:1,approved:1,pending:0,changesRequested:0},source:null,destination:{sprintId:'68',sprintName:'68',year:2026}};
test('historical view labels missing legacy details and exposes no mutation controls',()=>{
 const html=renderToStaticMarkup(React.createElement(ProjectSprintSnapshotView,{header,cases:[],total:0,page:1,currentHref:'/live',historyHref:'/history/e'}));
 assert.match(html,/ข้อมูลย้อนหลังแบบสรุป/);assert.match(html,/อ่านอย่างเดียว/);assert.match(html,/qa@test/);assert.match(html,/เปิดงานปัจจุบัน/);
 assert.doesNotMatch(html,/Add Result|แก้ไข Test Case|ซิงค์|ส่ง Approval/);
});
