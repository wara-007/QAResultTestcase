import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SprintOverviewMetrics } from './sprint-overview-metrics';
import type { Project } from '../lib/types';
import { buildSprintDashboard, type SprintDashboardData } from '../lib/sprint-dashboard';

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
  assert.doesNotMatch(html, /Completed Web/);
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
  assert.doesNotMatch(html, /Testing App|Passed App|Skipped App|Failed App/);
  data.summaryPending = [];
  const complete = renderToStaticMarkup(<SprintOverviewMetrics data={data} showSummary />);
  assert.match(complete, /SUN-7794/);
});
