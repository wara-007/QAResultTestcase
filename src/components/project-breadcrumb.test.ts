import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectBreadcrumb } from './project-breadcrumb';

test('project breadcrumb shows year and project with intermediate links inside a collapsed menu', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectBreadcrumb, {
    year: 2026, groupId: 'group', sprintHref: '/sprint', sprintName: 'Sprint67',
    projectsHref: '/projects', projectName: '[SUN-8148] Improve PDF',
  }));
  assert.match(html, /href="\/groups\?year=2026">ปี 2026<\/a>/);
  assert.match(html, /<summary[^>]*aria-label="เปิดเส้นทางย้อนกลับ"[^>]*>…<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]*\sopen/);
  const menu = html.match(/<details[\s\S]*?<\/details>/)?.[0] ?? '';
  assert.match(menu, /href="\/groups">เลือกปี/);
  assert.match(menu, /href="\/groups\?year=2026">Groups/);
  assert.match(menu, /href="\/groups\/group\/years\/2026\/sprints">Sprints/);
  assert.match(menu, /href="\/sprint">Sprint67/);
  assert.match(menu, /href="\/projects">Projects/);
  assert.match(html, /aria-current="page" title="\[SUN-8148\] Improve PDF"/);
});

test('legacy projects without a year do not generate invalid year or sprint URLs', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectBreadcrumb, {
    groupId: 'group', projectsHref: '/projects', projectName: 'Legacy project',
  }));
  assert.match(html, /href="\/groups">เลือกปี/);
  assert.doesNotMatch(html, /undefined|years\//);
  assert.match(html, /Legacy project/);
});
