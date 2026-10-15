import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectFileActions } from './project-file-actions';

const props = {
  page: 'files', projectId: 'project', googleSheetId: 'sheet', hasSource: true,
  canEdit: true, canManage: true, pulling: false, syncing: false, exporting: false,
  onUpload: () => {}, onPull: async () => {}, onSync: async () => {}, onDownload: async () => {},
};
test('Drive selection and exports live in separate groups on the Files page', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectFileActions, props));
  assert.match(html, /ไฟล์ต้นฉบับ/);
  assert.match(html, /เลือกไฟล์จาก Google Drive/);
  assert.match(html, /ส่งออกผลทดสอบ/);
  assert.match(html, /ซิงค์กลับ Google Sheets/);
  assert.match(html, /ดาวน์โหลด Result/);
});
test('file management actions never render on Test cases, other workspace pages, or detail routes', () => {
  for (const page of ['test-cases', 'overview', 'defects', 'settings']) {
    assert.equal(renderToStaticMarkup(React.createElement(ProjectFileActions, { ...props, page })), '');
  }
  assert.equal(renderToStaticMarkup(React.createElement(ProjectFileActions, { ...props, detail: true })), '');
});
test('read-only viewers retain download but cannot select Drive files or sync', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectFileActions, { ...props, canEdit: false, canManage: false }));
  assert.match(html, /ดาวน์โหลด Result/);
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/g)?.join('') ?? '';
  assert.doesNotMatch(buttons, /เลือกไฟล์จาก Google Drive|ซิงค์กลับ Google Sheets|อัปโหลด Excel/);
});
test('unconnected projects expose source setup, not unusable sync or download actions', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectFileActions, { ...props, googleSheetId: '', hasSource: false }));
  assert.match(html, /เชื่อม Google Sheet/);
  assert.match(html, /อัปโหลด Excel/);
  assert.doesNotMatch(html, /ซิงค์กลับ Google Sheets|ดาวน์โหลด Result/);
});
