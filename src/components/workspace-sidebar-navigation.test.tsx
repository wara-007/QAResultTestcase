import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceSidebarNavigation } from './workspace-sidebar-navigation';

const sprintHref = '/groups/mobile/years/2026/sprints/s41';

test('Sprint Projects navigation keeps Sprint destinations and excludes Project destinations', () => {
  const html = renderToStaticMarkup(<WorkspaceSidebarNavigation scope="sprint" sprintName="Sprint 41" sprintHref={sprintHref} backHref="/groups/mobile/years/2026/sprints" activePage="projects" />);
  assert.match(html, /href="\/groups\/mobile\/years\/2026\/sprints"/);
  assert.match(html, /href="\/groups\/mobile\/years\/2026\/sprints\/s41\?view=team"/);
  assert.match(html, /href="\/groups\/mobile\/years\/2026\/sprints\/s41\?view=history"/);
  assert.match(html, /aria-current="page"[^>]*href="\/groups\/mobile\/years\/2026\/sprints\/s41\/projects"/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Test cases|Defects|เลือกปี|Groups/);
});

test('Project details return to their Sprint Projects and exclude Sprint navigation', () => {
  const html = renderToStaticMarkup(<WorkspaceSidebarNavigation scope="project" backHref={`${sprintHref}/projects`} projectName="Mobile App" projectHref="/groups/mobile/projects/app" activePage="test-cases" />);
  assert.match(html, /href="\/groups\/mobile\/years\/2026\/sprints\/s41\/projects"/);
  assert.match(html, /aria-current="page"[^>]*href="\/groups\/mobile\/projects\/app\/test-cases"/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(html, /Defects/);
  assert.doesNotMatch(html, /ทีมใน Sprint|ประวัติ Sprint|ภาพรวม Sprint|เลือกปี|Groups/);
});

test('Sprint team and history select only their matching destination', () => {
  for (const page of ['team', 'history'] as const) {
    const html = renderToStaticMarkup(<WorkspaceSidebarNavigation scope="sprint" sprintName="Sprint 41" sprintHref={sprintHref} backHref="/groups/mobile/years/2026/sprints" activePage={page} />);
    assert.match(html, new RegExp(`aria-current="page"[^>]*href="/groups/mobile/years/2026/sprints/s41\\?view=${page}"`));
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  }
});

test('a Project without a Sprint retains its explicit fallback parent', () => {
  const html = renderToStaticMarkup(<WorkspaceSidebarNavigation scope="project" backHref="/groups/mobile/years" projectName="Imported Project" projectHref="/groups/mobile/projects/imported" activePage="files" />);
  assert.match(html, /href="\/groups\/mobile\/years"/);
  assert.doesNotMatch(html, /undefined|null/);
});
