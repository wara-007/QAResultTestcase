import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSprintDashboard } from '../lib/sprint-dashboard';
import type { Project } from '../lib/types';
import { TeamProjectReport } from './team-project-report';

test('team report opens with a member and their assigned project without a pass leaderboard',()=>{
  const data=buildSprintDashboard({sprintId:'s',projects:[{id:'p',name:'Payment',sprintId:'s',environment:'UAT'}] as Project[],team:[{userId:'qa',name:'QA One',email:'qa@example.test',role:'qa'}],assignments:[{projectId:'p',userId:'qa'}],stats:[],origins:[],moves:[],approvals:[],summaries:[{projectId:'p',counts:{totalCases:2,pass:1,failed:0,inProgress:0,skip:0,notStart:1,openDefects:0}}]});
  const html=renderToStaticMarkup(<TeamProjectReport data={data} groupId="g" year={2026}/>);
  assert.match(html,/งานและผลส่งมอบของทีม/);
  assert.match(html,/aria-pressed="true"/);
  assert.match(html,/QA One/);
  assert.match(html,/QA ที่รับผิดชอบ Project/);
  assert.match(html,/ยังไม่มีผลทดสอบของคนนี้/);
  assert.match(html,/กำลังทดสอบ/);
  assert.match(html,/href="\/groups\/g\/projects\/p\/overview"/);
  assert.doesNotMatch(html,/ผลการทดสอบรายบุคคล|<table|ปิด Project แล้ว/);
});

test('empty team report has an honest empty state',()=>{
  const data=buildSprintDashboard({sprintId:'s',projects:[],team:[],assignments:[],stats:[],origins:[],moves:[],approvals:[]});
  const html=renderToStaticMarkup(<TeamProjectReport data={data} groupId="g" year={2026}/>);
  assert.match(html,/ยังไม่มีงานที่เชื่อมโยงกับสมาชิก/);
  assert.doesNotMatch(html,/aria-label="เลือกสมาชิกเพื่อดูงาน"/);
});

test('project mode shows unassigned projects and their team rather than a personal empty state',()=>{
  const data=buildSprintDashboard({sprintId:'s',projects:[{id:'p',name:'Unassigned Project',sprintId:'s',environment:'UAT'}] as Project[],team:[],assignments:[],stats:[],origins:[],moves:[],approvals:[]});
  const html=renderToStaticMarkup(<TeamProjectReport data={data} groupId="g" year={2026} mode="project"/>);
  assert.match(html,/เลือก Project เพื่อดูทีม/);
  assert.match(html,/Unassigned Project/);
  assert.match(html,/href="\/groups\/g\/projects\/p\/overview"/);
  assert.match(html,/เปิด ภาพรวม Project/);
  assert.match(html,/ยังไม่มอบหมาย QA/);
  assert.doesNotMatch(html,/ยังไม่มีงานที่เชื่อมโยงกับสมาชิก|คนที่เลือก|ยังไม่มีผลทดสอบของคนนี้/);
});
