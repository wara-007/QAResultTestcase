import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSheetEvidenceImports, runSheetTextImports, sheetImportSummary, sheetImportProgressLabel } from './sheet-import-progress';

test('a short tab finishes and is saved while another tab is still uploading', async () => {
  let release!: () => void;
  const slow = new Promise<void>(resolve => { release = resolve; });
  let finishedFast!: () => void;
  const fast = new Promise<void>(resolve => { finishedFast = resolve; });
  const saved: string[] = [];
  const states: string[] = [];
  const importing = runSheetEvidenceImports(['slow', 'fast', 'empty'], [{ sheet: 'slow' }, { sheet: 'fast' }], image => image.sheet,
    async image => { if (image.sheet === 'slow') await slow; return true; },
    async (name, complete) => { assert.equal(complete, true); saved.push(name); },
    () => {}, (name, state) => { states.push(`${name}:${state}`); if (name === 'fast' && state === 'loaded') finishedFast(); }, 2);
  await fast;
  assert.ok(saved.includes('fast'));
  assert.equal(saved.includes('slow'), false);
  assert.equal(states.includes('slow:loaded'), false);
  release();
  await importing;
  assert.ok(states.includes('empty:loaded'));
});

test('a failed image does not finish its tab as loaded or stop unrelated tabs', async () => {
  const states: string[] = [];
  const saves: Array<[string, boolean]> = [];
  await runSheetEvidenceImports(['bad', 'good'], [{ sheet: 'bad' }, { sheet: 'good' }], image => image.sheet,
    async image => { if (image.sheet === 'bad') throw new Error('upload failed'); return true; },
    async (name, complete) => { saves.push([name, complete]); }, () => {}, (name, state) => states.push(`${name}:${state}`));
  assert.ok(states.includes('bad:error'));
  assert.ok(!states.includes('bad:loaded'));
  assert.ok(states.includes('good:loaded'));
  assert.deepEqual(saves.find(([name]) => name === 'bad'), ['bad', false]);
});

test('checkpoint writes are serialized and failed saves never report loaded', async () => {
  let saving = 0, maximum = 0;
  const states: string[] = [];
  await runSheetEvidenceImports(['a', 'b', 'c'], [], () => '', async () => true, async name => {
    saving++; maximum = Math.max(maximum, saving);
    await new Promise(resolve => setTimeout(resolve, 1));
    saving--;
    if (name === 'b') throw new Error('save failed');
  }, () => {}, (name, state) => states.push(`${name}:${state}`));
  assert.equal(maximum, 1);
  assert.ok(states.includes('b:error'));
  assert.ok(!states.includes('b:loaded'));
  assert.ok(states.includes('c:loaded'));
});

test('loaded waits for the durable checkpoint rather than just finished images', async () => {
  let release!: () => void, entered!: () => void;
  const checkpoint = new Promise<void>(resolve => { release = resolve; });
  const saving = new Promise<void>(resolve => { entered = resolve; });
  const states: string[] = [];
  const pending = runSheetEvidenceImports(['tab'], [], () => '', async () => true,
    async () => { entered(); await checkpoint; }, () => {}, (name, state) => states.push(`${name}:${state}`));
  await saving;
  assert.equal(states.includes('tab:loaded'), false);
  release(); await pending;
  assert.ok(states.includes('tab:loaded'));
});

test('uploads are bounded across tabs and unrelated sheets are not imported', async () => {
  let active = 0, maximum = 0;
  const seen: string[] = [];
  const tabs = ['a', 'b', 'c', 'd'];
  await runSheetEvidenceImports(tabs, [...tabs, 'unrelated'].map(sheet => ({ sheet })), item => item.sheet, async item => {
    active++; maximum = Math.max(maximum, active); seen.push(item.sheet);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--; return true;
  }, async () => {}, () => {}, () => {}, 3);
  assert.equal(maximum, 3);
  assert.deepEqual(seen.sort(), ['a', 'b', 'c', 'd']);
});

test('progress distinguishes text, workbook, images, saving and fully durable completion', () => {
  assert.equal(sheetImportProgressLabel('loading', { phase: 'details' }), 'กำลังโหลดรายละเอียด');
  assert.equal(sheetImportProgressLabel('loading', { phase: 'workbook' }), 'รายละเอียดพร้อม · รอไฟล์รูป');
  assert.equal(sheetImportProgressLabel('loading', { phase: 'images', completed: 2, total: 5 }), 'นำเข้ารูป 2/5');
  assert.equal(sheetImportProgressLabel('loading', { phase: 'saving' }), 'กำลังบันทึก');
  assert.equal(sheetImportProgressLabel('loaded', { phase: 'saving' }), '✓ โหลดแล้ว');
  assert.equal(sheetImportProgressLabel('error', { phase: 'images' }), 'โหลดไม่สำเร็จ');
  assert.equal(sheetImportProgressLabel('queued', { phase: 'conflict' }), 'รอยืนยันข้อมูลที่ขัดแย้ง');
});

test('text is saved per tab without waiting for all other tab reads', async () => {
  let release!: () => void, fastSaved!: () => void;
  const slow = new Promise<void>(resolve => { release = resolve; });
  const fast = new Promise<void>(resolve => { fastSaved = resolve; });
  const states: string[] = [];
  const pending = runSheetTextImports(['slow', 'fast'], async name => { if (name === 'slow') await slow; return name; },
    async name => { if (name === 'fast') fastSaved(); return true; },
    () => {}, (name, state) => states.push(`${name}:${state}`));
  await fast;
  assert.equal(states.includes('slow:loaded'), false);
  release(); await pending;
  assert.equal(states.some(value => value.endsWith(':loaded')), false);
});

test('conflicted text is not counted as saved and failed persistence is reported', async () => {
  const phases: Record<string, { detailsSaved?: boolean; phase: string }> = {};
  const states: Record<string, string> = {};
  await runSheetTextImports(['conflict', 'failed', 'good'], async name => name, async name => {
    if (name === 'failed') throw new Error('save failed');
    return name !== 'conflict';
  }, (name, value) => { phases[name] = value; }, (name, state) => { states[name] = state; });
  assert.equal(phases.conflict.detailsSaved, false);
  assert.equal(phases.good.detailsSaved, true);
  assert.equal(states.failed, 'error');
  assert.equal(states.good, 'loading');
});

test('summary advances saved text separately from fully loaded evidence', () => {
  assert.deepEqual(sheetImportSummary(['Testcase', 'TC01', 'TC02'], { Testcase: 'loaded', TC01: 'loading', TC02: 'loading' }, {
    TC01: { phase: 'workbook', detailsSaved: true }, TC02: { phase: 'details' },
  }), { total: 3, detailsSaved: 2, loaded: 1, failed: 0 });
});
