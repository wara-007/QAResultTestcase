import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { revisionCheckedWorkbook, WorkbookRevisionError } from './revision-checked-workbook';

function route(revisions: string[], fingerprint = 'xlsx-v2:correct') {
  let downloads = 0;
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/projects/[projectId]/google-sheet/workbook/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const routeModule = { exports: {} as { GET: (request: Request, context: { params: Promise<{projectId:string}> }) => Promise<Response> } };
  const dependencies: Record<string, unknown> = {
    '@/lib/project-access-server': { ProjectAccessError: class extends Error {}, requireProjectCapability: async () => ({ project: { google_sheet_id: 'sheet', name: 'Fixture' } }) },
    '@/lib/revision-checked-workbook': { revisionCheckedWorkbook, WorkbookRevisionError },
    '@/lib/workbook-revision': { workbookContentRevision: () => fingerprint },
    '@/lib/sheet-import-state': {},
    '@/lib/google-sheets': { readGoogleSheetRevision: async () => revisions.shift(), exportGoogleSheetWorkbook: async () => { downloads++; return new Uint8Array([1,2,3]).buffer; } },
    '@/lib/google-user-oauth': { getGoogleUserAuth: async () => ({}) },
    '@/lib/google-authorization': { needsGoogleAuthorization: () => false },
  };
  runInNewContext(compiled, { module: routeModule, exports: routeModule.exports, URL, Response, Error, Uint8Array, require: (id: string) => {
    if (!(id in dependencies)) throw Error(`Unexpected import ${id}`);
    return dependencies[id];
  } });
  return { get: (query:string) => routeModule.exports.GET(new Request(`http://localhost/api/projects/p/google-sheet/workbook?${query}`), { params: Promise.resolve({projectId:'p'}) }), downloads: () => downloads };
}
test('partial download returns bytes only if the captured Drive revision remains stable', async () => {
  const stable=route(['drive:2','drive:2']);
  assert.equal((await stable.get('expectedRevision=drive%3A2')).status,200);
  assert.equal(stable.downloads(),1);
  const changed=route(['drive:2','drive:3']);
  assert.equal((await changed.get('expectedRevision=drive%3A2')).status,409);
});
test('content-hash partial downloads validate the actual workbook bytes', async () => {
  const stable=route([]);
  assert.equal((await stable.get('expectedRevision=xlsx-v2%3Acorrect')).status,200);
  const changed=route([],'xlsx-v2:other');
  assert.equal((await changed.get('expectedRevision=xlsx-v2%3Acorrect')).status,409);
});
test('empty, oversized, and conflicting revision selectors cannot bypass validation', async () => {
  for (const query of ['expectedRevision=','expectedRevision='+ 'x'.repeat(513),'expectedRevision=drive%3A2&sourceId=source']) {
    const api=route([]);
    assert.equal((await api.get(query)).status,409);
    assert.equal(api.downloads(),0);
  }
});
