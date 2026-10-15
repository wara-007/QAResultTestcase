import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withImportTimeout } from './import-timeout';

test('a hung import is aborted and reports the stage instead of waiting forever', async () => {
  let aborted = false;
  await assert.rejects(withImportTimeout(signal => {
    signal.addEventListener('abort', () => { aborted = true; });
    return new Promise(() => {});
  }, 5, 'ดาวน์โหลดไฟล์ต้นฉบับ'), /ดาวน์โหลดไฟล์ต้นฉบับ.*นานเกินกำหนด/);
  assert.equal(aborted, true);
});
test('successful imports preserve their result and original errors', async () => {
  assert.equal(await withImportTimeout(async () => 'done', 100, 'รายละเอียด'), 'done');
  const error = new Error('permission denied');
  await assert.rejects(withImportTimeout(async () => { throw error; }, 100, 'รายละเอียด'), value => value === error);
});
