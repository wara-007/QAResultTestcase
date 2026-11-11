import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { readGoogleSourceRevision } from './google-source-revision';
import { clearProjectWorkbook, getProjectWorkbook } from './workbook-cache';
import { sheetRevisionStreamType, streamGoogleRevision } from './google-revision-stream';

test('fallback revision bytes satisfy the later workbook load without another request', async () => {
  clearProjectWorkbook('revision-project');
  const request = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, options?: RequestInit) => {
    assert.equal(options?.cache, 'no-store');
    return new Response(new Uint8Array([1, 2, 3]), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'X-Workbook-Revision': 'xlsx-v2:fixture',
    } });
  });
  try {
    const revision = await readGoogleSourceRevision('revision-project', 'sheet', () => {});
    assert.equal(revision, 'xlsx-v2:fixture');
    const bytes = await getProjectWorkbook(`revision-project:google:sheet:${revision}`, async () => { throw new Error('duplicate download'); });
    assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3]);
    assert.equal(request.mock.callCount(), 1);
    assert.match(String(request.mock.calls[0].arguments[0]), /includeWorkbook=1/);
  } finally { request.mock.restore(); clearProjectWorkbook('revision-project'); }
});

test('metadata-only revisions still request fresh data and preserve abort signal', async () => {
  const controller = new AbortController();
  let version = 1;
  const request = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, options?: RequestInit) => {
    assert.equal(options?.signal, controller.signal);
    return Response.json({ revision: `drive:${version++}` });
  });
  try {
    assert.equal(await readGoogleSourceRevision('p', 's', () => {}, controller.signal), 'drive:1');
    assert.equal(await readGoogleSourceRevision('p', 's', () => {}, controller.signal), 'drive:2');
  } finally { request.mock.restore(); }
});

test('HTML failures show HTTP status rather than a JSON syntax error', async () => {
  const request = mock.method(globalThis, 'fetch', async () => new Response('<HTML>gateway timeout</HTML>', { status: 504 }));
  try { await assert.rejects(readGoogleSourceRevision('p', 's', () => {}), /504/); }
  finally { request.mock.restore(); }
});

test('verification-only checks do not request file transfer and completed revisions are sent as a condition', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ revision: 'xlsx-v2:known' }));
  try {
    await readGoogleSourceRevision('p', 's', () => {}, undefined, { includeWorkbook: false });
    assert.equal(new URL(String(request.mock.calls[0].arguments[0]), 'http://localhost').searchParams.has('includeWorkbook'), false);
    await readGoogleSourceRevision('p', 's', () => {}, undefined, { knownRevision: 'xlsx-v2:known' });
    assert.equal(new URL(String(request.mock.calls[1].arguments[0]), 'http://localhost').searchParams.get('knownRevision'), 'xlsx-v2:known');
  } finally { request.mock.restore(); }
});

test('authorization failures retain the consent flow and never return a revision', async () => {
  let authUrl = '';
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ authUrl: '/api/google/auth/start' }, { status: 401 }));
  try {
    await assert.rejects(readGoogleSourceRevision('p', 's', url => { authUrl = url; }), /Google/);
    assert.equal(authUrl, '/api/google/auth/start');
  } finally { request.mock.restore(); }
});

test('missing revision and binary response errors cannot poison the workbook cache', async () => {
  for (const response of [Response.json({}), new Response(new Uint8Array([1]), { status: 500, headers: { 'X-Workbook-Revision': 'xlsx-v2:bad' } })]) {
    const request = mock.method(globalThis, 'fetch', async () => response);
    try { await assert.rejects(readGoogleSourceRevision('bad', 'sheet', () => {})); }
    finally { request.mock.restore(); }
  }
  assert.deepEqual([...new Uint8Array(await getProjectWorkbook('bad:google:sheet:xlsx-v2:bad', async () => new Uint8Array([9]).buffer))], [9]);
  clearProjectWorkbook('bad');
});

test('the browser caches a complete streamed workbook and rejects truncated streams', async () => {
  const id = 'streamed-revision';
  const revision = 'xlsx-v2:changed';
  const request = mock.method(globalThis, 'fetch', async () => streamGoogleRevision(
    async () => ({ revision, workbook: new Uint8Array([1, 2, 3]).buffer }),
    async () => ({ status: 504, error: 'timed out' }),
    new AbortController().signal,
  ));
  try {
    assert.equal(await readGoogleSourceRevision(id, 'sheet', () => {}), revision);
    const cached = await getProjectWorkbook(`${id}:google:sheet:${revision}`, async () => { throw new Error('duplicate download'); });
    assert.deepEqual([...new Uint8Array(cached)], [1, 2, 3]);
  } finally { request.mock.restore(); clearProjectWorkbook(id); }

  const truncated = mock.method(globalThis, 'fetch', async () => new Response(
    '\n{"revision":"xlsx-v2:partial","workbookLength":3}\nX', { headers: { 'Content-Type': sheetRevisionStreamType } },
  ));
  try { await assert.rejects(readGoogleSourceRevision(id, 'sheet', () => {}), /ไม่ครบ/); }
  finally { truncated.mock.restore(); }
});

test('the browser reads timeout and Google authorization from a stream that already started', async () => {
  let authorization = '';
  for (const frame of [{ status: 504, error: 'Sheets timeout' }, { status: 401, authUrl: '/api/google/auth/start' }]) {
    const request = mock.method(globalThis, 'fetch', async () => new Response(
      `\n${JSON.stringify(frame)}\n`, { headers: { 'Content-Type': sheetRevisionStreamType } },
    ));
    try { await assert.rejects(readGoogleSourceRevision('p', 'sheet', url => { authorization = url; }), frame.status === 504 ? /Sheets timeout/ : /Google/); }
    finally { request.mock.restore(); }
  }
  assert.equal(authorization, '/api/google/auth/start');
});
