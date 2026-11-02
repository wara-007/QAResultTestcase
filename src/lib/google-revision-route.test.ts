import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ImportTimeoutError, withImportTimeout } from './import-timeout';

function route(denied = false, fallback = true) {
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/projects/[projectId]/google-sheet/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  class ProjectAccessError extends Error { status = 403; }
  let snapshots = 0;
  const dependencies: Record<string, unknown> = {
    '@/lib/project-access-server': { ProjectAccessError, requireProjectCapability: async (id: string, capability: string) => {
      assert.equal(id, 'project'); assert.equal(capability, 'view');
      if (denied) throw new ProjectAccessError('denied');
      return { project: { google_sheet_id: 'sheet' } };
    } },
    '@/lib/google-sheets': {
      readGoogleSheetRevision: async () => 'xlsx-v2:fixture',
      readGoogleSheetRevisionSnapshot: async (id: string) => {
        assert.equal(id, 'sheet'); snapshots++;
        return fallback ? { revision: 'xlsx-v2:fixture', workbook: new Uint8Array([1, 2, 3]).buffer } : { revision: 'drive:42' };
      },
    },
    '@/lib/project-defect-cache': {},
    '@/lib/import-timeout': { ImportTimeoutError, withImportTimeout },
    '@/lib/google-user-oauth': { getGoogleUserAuth: async () => ({}) },
    '@/lib/google-authorization': { needsGoogleAuthorization: () => false },
    '@/lib/sync/canonical': {}, '@/lib/sync/store': {}, '@/lib/supabase/admin': {},
  };
  const routeModule = { exports: {} as { GET: (request: Request, context: unknown) => Promise<Response> } };
  runInNewContext(compiled, { module: routeModule, exports: routeModule.exports, URL, Response, Error, require: (id: string) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
    return dependencies[id];
  } });
  return {
    get: (query: string) => routeModule.exports.GET(new Request(`http://localhost/api/projects/project/google-sheet?revision=1${query}`), { params: Promise.resolve({ projectId: 'project' }) }),
    snapshots: () => snapshots,
  };
}

test('revision endpoint sends reusable fallback bytes only when explicitly requested and changed', async () => {
  const api = route();
  const binary = await api.get('&includeWorkbook=1&knownRevision=xlsx-v2%3Aolder');
  assert.equal(binary.status, 200);
  assert.equal(binary.headers.get('X-Workbook-Revision'), 'xlsx-v2:fixture');
  assert.equal(binary.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())], [1, 2, 3]);
  const unchanged = await api.get('&includeWorkbook=1&knownRevision=xlsx-v2%3Afixture');
  assert.deepEqual(await unchanged.json(), { revision: 'xlsx-v2:fixture' });
  assert.equal(unchanged.headers.get('X-Workbook-Revision'), null);
  const legacy = await api.get('');
  assert.deepEqual(await legacy.json(), { revision: 'xlsx-v2:fixture' });
});

test('metadata-only revisions return JSON and unauthorized projects cannot export', async () => {
  const metadata = await route(false, false).get('&includeWorkbook=1');
  assert.deepEqual(await metadata.json(), { revision: 'drive:42' });
  const denied = route(true);
  assert.equal((await denied.get('&includeWorkbook=1')).status, 403);
  assert.equal(denied.snapshots(), 0);
});
