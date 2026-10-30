import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectTeamParticipation } from './project-team-participation';
import type { TestCase } from '@/lib/types';

test('participation is expandable, initially closed, and links to existing case route', () => {
 const cases=[{id:'TC 1',name:'Payment',status:'Pass',executedBy:'QA One'}] as TestCase[];
 const html=renderToStaticMarkup(<ProjectTeamParticipation cases={cases} projectHref="/groups/g/projects/p" />);
 assert.match(html, /การมีส่วนร่วมของทีม/);assert.match(html, /<details/);assert.doesNotMatch(html, /<details[^>]*open/);
 assert.match(html, /\/groups\/g\/projects\/p\/test-cases\/TC%201/);assert.match(html, /ไม่มีรายละเอียด Step/);
});
test('loading and no participation have explicit states', () => {
 assert.match(renderToStaticMarkup(<ProjectTeamParticipation cases={[]} projectHref="/p" loading />), /กำลังโหลดข้อมูลการทดสอบ/);
 assert.match(renderToStaticMarkup(<ProjectTeamParticipation cases={[]} projectHref="/p" />), /ยังไม่มีข้อมูลผู้ทดสอบ/);
});
