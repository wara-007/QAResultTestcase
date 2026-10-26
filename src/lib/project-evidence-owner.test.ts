import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { DriveEvidenceFolders } from './drive-evidence-folders';
import { needsGoogleAuthorization } from './google-authorization';
import { validateEvidenceFile, evidenceExtension } from './evidence-media';

class ProjectAccessError extends Error { constructor(message: string, readonly status: number) { super(message); } }
class GoogleConnectionRequiredError extends Error { constructor() { super('Connect Google'); this.name = 'GoogleConnectionRequiredError'; } }
function evidenceRoute(options: { actor?: string; owner?: string | null; missing?: boolean; revoked?: boolean; denied?: boolean; r2?: boolean } = {}) {
  const actor = options.actor ?? 'editor-B';
  const owner = options.owner === undefined ? 'creator-A' : options.owner;
  const lookups: string[] = [], uploaded: { account: string; body: Record<string, unknown> }[] = [];
  let editorAuthCalls = 0, r2Uploads = 0;
  const oauth = () => ({ account: '', setCredentials(credentials: { account: string }) { this.account = credentials.account; } });
  const admin = { from(table: string) { assert.equal(table, 'google_oauth_connections'); return { select() { return { eq(column: string, value: string) {
    assert.equal(column, 'user_id'); lookups.push(value);
    return { async maybeSingle() { return { data: options.missing ? null : { token_ciphertext: value }, error: null }; } };
  } }; } }; } };
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/projects/[projectId]/evidence/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const serverModule = { exports: {} as { POST(request: Request, context: { params: Promise<{ projectId: string }> }): Promise<Response> } };
  runInNewContext(compiled, { module: serverModule, exports: serverModule.exports, Response, Request, File, Blob, Buffer, Error, process: { env: {} },
    require(id: string) {
      if (id === '@/lib/project-access-server') return { ProjectAccessError, requireProjectCapability: async (projectId: string, capability: string) => {
        assert.equal(projectId, 'project'); assert.equal(capability, 'edit');
        if (options.denied) throw new ProjectAccessError('Read only', 403);
        return { userId: actor, project: { id: 'project', name: 'Release', owner_id: owner, google_sheet_id: 'sheet' } };
      } };
      if (id === '@/lib/supabase/admin') return { createAdminClient: () => admin };
      if (id === '@/lib/google-user-oauth') return { GoogleConnectionRequiredError, googleOAuthClient: oauth, openGoogleToken: (value: string) => ({ account: value }), getGoogleUserAuth: async () => { editorAuthCalls++; return { account: actor }; } };
      if (id === '@/lib/google-authorization') return { needsGoogleAuthorization };
      if (id === '@/lib/drive-evidence-folders') return { DriveEvidenceFolders };
      if (id === '@/lib/evidence-media') return { validateEvidenceFile, evidenceExtension };
      if (id === '@/lib/r2') return { getR2Config: () => options.r2 ? {} : null, uploadR2Object: async () => { r2Uploads++; return 'https://example.com/r2'; } };
      if (id === 'googleapis') return { google: { drive: ({ auth }: { auth: { account: string } }) => ({ files: {
        list: async () => { if (options.revoked) throw Object.assign(new Error('invalid_grant'), { response: { status: 401 } }); return { data: { files: [] } }; },
        create: async (input: { requestBody: Record<string, unknown>; media?: unknown }) => {
          if (input.media) uploaded.push({ account: auth.account, body: input.requestBody });
          return { data: { id: 'file-or-folder', name: 'image.png', mimeType: 'image/png' } };
        },
      }, permissions: { create: async () => ({}) } }) } };
      return localRequire(id);
    },
  });
  return { lookups, uploaded, editorAuthCalls: () => editorAuthCalls, r2Uploads: () => r2Uploads, async post(testCaseId = 'TC_01') {
    const form = new FormData(); form.set('file', new File(['image'], 'image.png', { type: 'image/png' })); form.set('testCaseId', testCaseId);
    // A request-supplied owner must never influence the account selection.
    form.set('ownerId', 'attacker');
    return serverModule.exports.POST(new Request('http://localhost/api/projects/project/evidence', { method: 'POST', body: form }), { params: Promise.resolve({ projectId: 'project' }) });
  } };
}

test('both the creator and another editor upload new images into the creator Drive', async () => {
  for (const actor of ['creator-A', 'editor-B']) {
    const route = evidenceRoute({ actor }); const response = await route.post();
    assert.equal(response.status, 200); assert.deepEqual(route.lookups, ['creator-A']);
    assert.equal(route.uploaded[0].account, 'creator-A'); assert.equal(route.editorAuthCalls(), 0);
    assert.equal(route.uploaded[0].body.appProperties && (route.uploaded[0].body.appProperties as Record<string, string>).qaUploadedBy, actor);
    assert.equal((await response.json()).evidence.uploadedBy, actor);
  }
});
test('new images use creator Drive even when R2 is configured', async () => {
  const route = evidenceRoute({ r2: true }); assert.equal((await route.post()).status, 200);
  assert.equal(route.uploaded[0]?.account, 'creator-A'); assert.equal(route.r2Uploads(), 0);
});
test('an editor cannot substitute their own Google connection when the creator is disconnected', async () => {
  const route = evidenceRoute({ missing: true }); const response = await route.post(); const body = await response.json();
  assert.equal(response.status, 409); assert.equal(body.code, 'PROJECT_OWNER_GOOGLE_CONNECTION_REQUIRED');
  assert.match(body.error, /ผู้สร้าง/); assert.equal(body.authUrl, undefined);
  assert.equal(route.editorAuthCalls(), 0); assert.equal(route.uploaded.length, 0);
});
test('only the creator receives a reconnect action for their missing connection', async () => {
  const route = evidenceRoute({ actor: 'creator-A', missing: true }); const response = await route.post();
  assert.equal(response.status, 401); assert.equal((await response.json()).authUrl, '/api/google/auth/start');
});
test('revoked creator access stops the editor upload without redirecting their Google account', async () => {
  const route = evidenceRoute({ revoked: true }); const response = await route.post(); const body = await response.json();
  assert.equal(response.status, 409); assert.equal(body.code, 'PROJECT_OWNER_GOOGLE_CONNECTION_REQUIRED'); assert.equal(body.authUrl, undefined);
  assert.equal(route.uploaded.length, 0);
});
test('projects without a creator stop rather than falling back to the editor', async () => {
  const route = evidenceRoute({ owner: null }); const response = await route.post();
  assert.equal(response.status, 409); assert.equal(route.lookups.length, 0); assert.equal(route.uploaded.length, 0);
});
test('project edit permission is checked before reading any creator connection', async () => {
  const route = evidenceRoute({ denied: true }); assert.equal((await route.post()).status, 403);
  assert.equal(route.lookups.length, 0); assert.equal(route.uploaded.length, 0);
});

function signedUploadRoute() {
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL('../app/api/projects/[projectId]/evidence/upload/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const serverModule = { exports: {} as Record<'POST' | 'PATCH', (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response>> };
  let presigned = 0, inspected = 0;
  runInNewContext(compiled, { module: serverModule, exports: serverModule.exports, Response, Buffer, Error, process: { env: { R2_SECRET_ACCESS_KEY: 'test-secret' } }, require(id: string) {
    if (id === '@/lib/project-access-server') return { ProjectAccessError, requireProjectCapability: async () => ({ userId: 'editor-B' }) };
    if (id === '@/lib/evidence-media') return { evidenceExtension, validateEvidenceFile };
    if (id === '@/lib/r2') return { getR2Config: () => ({ publicBaseUrl: 'https://example.com' }), presignR2Upload: async () => { presigned++; return 'https://example.com/upload'; }, inspectR2Object: async () => { inspected++; return { ContentLength: 5, ContentType: 'video/mp4' }; } };
    return localRequire(id);
  } });
  return { presigned: () => presigned, inspected: () => inspected, call(method: 'POST' | 'PATCH', body: unknown) {
    return serverModule.exports[method](new Request('http://localhost/api/projects/project/evidence/upload', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ projectId: 'project' }) });
  } };
}
test('signed R2 uploads cannot bypass creator Drive by accepting images', async () => {
  const route = signedUploadRoute();
  const response = await route.call('POST', { name: 'image.png', type: 'image/png', size: 5, testCaseId: 'TC_01' });
  assert.equal(response.status, 400); assert.equal(route.presigned(), 0);
  const body = Buffer.from(JSON.stringify({ projectId: 'project', userId: 'editor-B', key: 'projects/project/image.png', name: 'image.png', type: 'image/png', size: 5, expires: Date.now() + 60_000 })).toString('base64url');
  const ticket = `${body}.${createHmac('sha256', 'test-secret').update(body).digest('base64url')}`;
  assert.equal((await route.call('PATCH', { ticket })).status, 400); assert.equal(route.inspected(), 0);
});
test('signed video uploads still finalize in R2', async () => {
  const route = signedUploadRoute();
  const response = await route.call('POST', { name: 'clip.mp4', type: 'video/mp4', size: 5, testCaseId: 'TC_01' });
  assert.equal(response.status, 200);
  const complete = await route.call('PATCH', { ticket: (await response.json()).ticket });
  assert.equal(complete.status, 200); assert.equal((await complete.json()).evidence.provider, 'cloudflare-r2');
});


test('spreadsheet case IDs with multiline annotations retain creator Drive upload support', async () => {
  const route = evidenceRoute();
  assert.equal((await route.post('DCB01_TC01\n*U01')).status, 200);
  assert.equal(route.uploaded[0]?.account, 'creator-A');
});
test('unsafe control characters in case IDs are still rejected', async () => {
  const route = evidenceRoute();
  assert.equal((await route.post('DCB01\u0000_TC01')).status, 400);
  assert.equal(route.uploaded.length, 0);
});
