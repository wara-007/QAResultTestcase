import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SprintOverviewMetrics } from './sprint-overview-metrics';
import type { Project } from '../lib/types';
import { buildSprintDashboard, type SprintDashboardData } from '../lib/sprint-dashboard';
import type { SnapshotHeader } from '../lib/project-sprint-participation';

function dashboard(projects: number, missing: number): SprintDashboardData {
  const data: SprintDashboardData = buildSprintDashboard({sprintId:'s', projects:[], team:[], assignments:[], stats:[], approvals:[], origins:[], moves:[]});
  Object.assign(data.summary, {projects, totalCases:77, pass:64, notStart:13});
  data.summaryPending = Array.from({length:missing}, (_, i) => `p${i}`);
  return data;
}
function render(projects: number, missing: number) {
  return renderToStaticMarkup(<SprintOverviewMetrics data={dashboard(projects, missing)} showSummary />);
}

test('available Sprint totals stay visible when some projects have no saved summary', () => {
  const html = render(7, 4);
  assert.match(html, /<strong>77<\/strong>/);
  assert.match(html, /<strong>64<\/strong>/);
  assert.match(html, /<strong>13<\/strong>/);
  assert.match(html, /รวมเฉพาะ 3 \/ 7 Projects/);
  assert.match(html, /ยังไม่มียอดสรุป 4 Projects/);
});

test('all unknown projects keep metrics unknown rather than claiming zero', () => {
  const html = render(4, 4);
  assert.equal((html.match(/<strong>—<\/strong>/g) ?? []).length, 6);
});

test('complete and empty Sprints show totals without an incomplete warning', () => {
  for (const projects of [0, 3]) {
    const html = render(projects, 0);
    assert.match(html, /<strong>77<\/strong>/);
    assert.doesNotMatch(html, /ยังไม่มียอดสรุป|รวมเฉพาะ/);
  }
});


test('overview names missing-summary projects as not started and excludes completed projects', () => {
  const data: SprintDashboardData = buildSprintDashboard({sprintId:'s', projects:[
    {id:'pending', name:'Mobile App', sprintId:'s'},
    {id:'ready', name:'Completed Web', sprintId:'s'},
  ] as Project[], team:[], assignments:[], stats:[], approvals:[], origins:[], moves:[], summaries:[
    {projectId:'ready', counts:{totalCases:1,pass:1,failed:0,skip:0,inProgress:0,notStart:0,openDefects:0}},
  ]});
  data.summaryPending = ['pending'];
  const html = renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary />);
  assert.match(html, /<li[^>]*>.*Mobile App.*ยังไม่ได้เริ่ม.*<\/li>/);
  assert.doesNotMatch(html.match(/<ul>.*?<\/ul>/)?.[0] ?? '', /Completed Web/);
  const hidden = renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary={false} />);
  assert.doesNotMatch(hidden, /Mobile App|ยังไม่ได้เริ่ม/);
});

test('projects with saved summaries but no started cases appear alongside missing summaries', () => {
  const data: SprintDashboardData = buildSprintDashboard({sprintId:'s', projects:[
    {id:'untouched',name:'SUN-7794',sprintId:'s'},
    {id:'active',name:'Testing App',sprintId:'s'},
    {id:'done',name:'Passed App',sprintId:'s'},
    {id:'skipped',name:'Skipped App',sprintId:'s'},
    {id:'failed',name:'Failed App',sprintId:'s'},
    {id:'missing',name:'Missing Summary',sprintId:'s'},
  ] as Project[], team:[], assignments:[], stats:[], approvals:[], origins:[], moves:[], summaries:[
    {projectId:'untouched',counts:{totalCases:24,notStart:24,pass:0,failed:0,skip:0,inProgress:0,openDefects:0}},
    {projectId:'active',counts:{totalCases:1,notStart:0,pass:0,failed:0,skip:0,inProgress:1,openDefects:0}},
    {projectId:'done',counts:{totalCases:1,notStart:0,pass:1,failed:0,skip:0,inProgress:0,openDefects:0}},
    {projectId:'skipped',counts:{totalCases:1,notStart:0,pass:0,failed:0,skip:1,inProgress:0,openDefects:0}},
    {projectId:'failed',counts:{totalCases:1,notStart:0,pass:0,failed:1,skip:0,inProgress:0,openDefects:0}},
  ]});
  data.summaryPending = ['missing'];
  const html = renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary />);
  assert.match(html, /SUN-7794/);
  assert.match(html, /Missing Summary/);
  assert.doesNotMatch(html.match(/<ul>.*?<\/ul>/)?.[0] ?? '', /Testing App|Passed App|Skipped App|Failed App/);
  data.summaryPending = [];
  const complete = renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary />);
  assert.match(complete, /SUN-7794/);
});

test('overview groups metrics with closed project details and all six saved counts', () => {
  const data = buildSprintDashboard({sprintId:'s', projects:[{id:'p',name:'Payment',sprintId:'s'}] as Project[], team:[], assignments:[], stats:[], approvals:[], origins:[], moves:[], summaries:[
    {projectId:'p',counts:{totalCases:21,pass:10,failed:2,inProgress:3,skip:4,notStart:2,openDefects:0}},
  ]});
  const html = renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary />);
  const details = html.match(/<details[^>]*>.*?<\/details>/)?.[0];
  assert.ok(details, 'per-project details are available within the summary');
  assert.doesNotMatch(details.match(/^<details[^>]*>/)![0], /\bopen(?:=|\s|>)/);
  assert.match(html, /<section[^>]*aria-label="ภาพรวม Sprint"[^>]*>.*<strong>21<\/strong>.*<details/);
  assert.match(details, /Payment/);
  assert.match(details, /<td[^>]*>21<\/td><td[^>]*>10<\/td><td[^>]*>2<\/td><td[^>]*>3<\/td><td[^>]*>4<\/td><td[^>]*>2<\/td>/);
  assert.match(details, /<tfoot>/);
  assert.doesNotMatch(renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary={false} />), /<details|Payment/);
});

test('project details keep missing summaries unknown and use frozen counts for continued work', () => {
  const header: SnapshotHeader = {
    version:1,participation:{id:'episode',projectId:'old',sprintId:'s',enteredAt:null,exitedAt:'2026-10-24',previousId:null,nextId:'next',actorName:'',reason:'continue',snapshotKind:'full'},
    project:{id:'old',name:'Frozen Project',description:'',environment:'UAT'},
    counts:{totalCases:8,pass:5,failed:1,inProgress:0,skip:2,notStart:0,openDefects:0},qa:[],
    approval:{projectId:'old',total:0,approved:0,pending:0,changesRequested:0},source:null,
  };
  const data: SprintDashboardData = buildSprintDashboard({sprintId:'s',projects:[{id:'missing',name:'Missing Project',sprintId:'s'}] as Project[],team:[],assignments:[],stats:[],approvals:[],origins:[],moves:[],headers:[header],episodes:[header.participation]});
  data.summaryPending=['missing'];
  const html=renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary />);
  const details=html.match(/<details[^>]*>.*?<\/details>/)?.[0];
  assert.ok(details);
  const rows=details.match(/<tr>.*?<\/tr>/g) ?? [];
  const missing=rows.find(row=>row.includes('Missing Project'))!;
  assert.match(missing,/ยังไม่มียอดสรุป/);
  assert.equal((missing.match(/>—<\/td>/g) ?? []).length,6);
  const frozen=rows.find(row=>row.includes('Frozen Project'))!;
  assert.match(frozen,/<td[^>]*>8<\/td><td[^>]*>5<\/td><td[^>]*>1<\/td><td[^>]*>0<\/td><td[^>]*>2<\/td><td[^>]*>0<\/td>/);
  assert.match(frozen,/ส่งต่อแล้ว/);
});
