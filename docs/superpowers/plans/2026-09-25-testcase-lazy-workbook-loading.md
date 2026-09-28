# Testcase Lazy Workbook Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Testcases list render without downloading the stored Excel workbook, while preserving previews, sheet details, export, and Google refresh behavior through lazy loading.

**Architecture:** Split project workspace loading into relational data/metadata and optional workbook bytes. Track whether bytes are present in the client navigation cache, and request them only before an operation that parses or exports the workbook.

**Tech Stack:** Next.js 16.3.4 App Router, React 19, TypeScript 5.9, Supabase JS/Storage, `tsx` regression tests.

**Spec:** Performance requirement discussed alongside `docs/superpowers/specs/2026-09-25-google-sheets-sync-conflict-resolution-design.md`; this plan is intentionally independent of conflict resolution.

## Global Constraints

- The Testcases list must continue showing every Test Case available from Supabase plus Google Sheets summary data.
- No workbook bytes may be downloaded merely to render the Testcases table.
- Workbook-dependent actions must retain current output and load bytes at most once per browser-tab/project cache lifetime.
- Existing unsynced-change behavior must remain unchanged.
- No new runtime dependency is allowed.

## Review Focus

- Projects whose stored workbook is chunked must reassemble all chunks in order before parsing; Task 1 tests this through an injected downloader.
- Legacy projects with a single stored object must still lazy-load correctly; Task 1 covers the non-chunk path.
- Export triggered before any detail view must await bytes instead of exporting an empty archive; Task 3 tests this flow.
- Concurrent preview/export requests must share one in-flight download; Task 2 tests promise deduplication.
- A workbook download failure must leave the Testcases table usable and permit retry; Task 2 tests cache recovery after rejection.

---

### Task 1: Separate Workspace Metadata from Workbook Bytes

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/project-data.ts`
- Create: `src/lib/workbook-loading.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `WorkbookSource.bufferLoaded: boolean`.
- Produces: `loadProjectWorkspace(projectId: string, options?: { includeWorkbook?: boolean }): Promise<ProjectWorkspace>`.
- Produces: `loadProjectWorkbook(projectId: string): Promise<ArrayBuffer>`.

- [ ] **Step 1: Write failing tests for metadata-only, chunked, and legacy loads**

Create tests around an exported pure helper:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { assembleWorkbookBytes } from "./project-data";

test("metadata-only workspace does not call workbook downloader", async () => {
  let calls = 0;
  const bytes = await assembleWorkbookBytes({ chunkCount: 2, download: async () => { calls += 1; return new Uint8Array([1]); }, includeWorkbook: false });
  assert.equal(calls, 0);
  assert.equal(bytes.byteLength, 0);
});

test("chunked workbook is assembled in index order", async () => {
  const bytes = await assembleWorkbookBytes({ chunkCount: 2, download: async (path) => new Uint8Array([path.endsWith("001") ? 2 : 1]), includeWorkbook: true });
  assert.deepEqual([...new Uint8Array(bytes)], [1, 2]);
});

test("legacy workbook downloads its single storage key", async () => {
  const requested: string[] = [];
  await assembleWorkbookBytes({ chunkCount: 0, storageKey: "project/source.xlsx", download: async (path) => { requested.push(path); return new Uint8Array([1]); }, includeWorkbook: true });
  assert.deepEqual(requested, ["project/source.xlsx"]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx tsx --test src/lib/workbook-loading.test.ts`

Expected: FAIL because `assembleWorkbookBytes`, `bufferLoaded`, and loader options do not exist.

- [ ] **Step 3: Implement optional workbook loading**

Add `bufferLoaded` to `WorkbookSource`; imported/uploaded sources set it to `true`. `loadProjectWorkspace` defaults `includeWorkbook` to `false`, returns an empty `ArrayBuffer` plus `bufferLoaded: false`, and downloads bytes only when explicitly requested. `loadProjectWorkbook` reuses the same source-file lookup and chunk assembly.

- [ ] **Step 4: Run focused and type tests**

Run: `npx tsx --test src/lib/workbook-loading.test.ts && npm run typecheck`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/project-data.ts src/lib/workbook-loading.test.ts package.json
git commit -m "perf: split workspace metadata from workbook bytes"
```

### Task 2: Add Deduplicated Browser Workbook Loading

**Files:**
- Create: `src/lib/workbook-cache.ts`
- Create: `src/lib/workbook-cache.test.ts`
- Modify: `src/components/qa-workspace.tsx`

**Interfaces:**
- Consumes: `loadProjectWorkbook(projectId)` and `WorkbookSource.bufferLoaded` from Task 1.
- Produces: `getProjectWorkbook(projectId: string, loader: () => Promise<ArrayBuffer>): Promise<ArrayBuffer>`.
- Produces: `clearProjectWorkbook(projectId: string): void`.
- Produces inside `QaWorkspace`: `ensureWorkbookLoaded(): Promise<WorkbookSource>`.

- [ ] **Step 1: Write failing cache tests**

```ts
test("concurrent callers share one workbook request", async () => {
  let calls = 0;
  const loader = async () => { calls += 1; return new Uint8Array([1]).buffer; };
  await Promise.all([getProjectWorkbook("p1", loader), getProjectWorkbook("p1", loader)]);
  assert.equal(calls, 1);
});

test("failed request is removed so retry can succeed", async () => {
  let calls = 0;
  await assert.rejects(getProjectWorkbook("p2", async () => { calls += 1; throw new Error("offline"); }));
  const bytes = await getProjectWorkbook("p2", async () => { calls += 1; return new Uint8Array([2]).buffer; });
  assert.equal(new Uint8Array(bytes)[0], 2);
  assert.equal(calls, 2);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx tsx --test src/lib/workbook-cache.test.ts`

Expected: FAIL because the cache module does not exist.

- [ ] **Step 3: Implement promise-deduplicating cache and component loader**

The cache stores resolved bytes and in-flight promises by project ID. `ensureWorkbookLoaded` returns the current source when `bufferLoaded`, otherwise awaits `getProjectWorkbook`, updates `source`, and updates `workspaceNavigationCache` without changing Test Case data.

- [ ] **Step 4: Verify focused tests**

Run: `npx tsx --test src/lib/workbook-cache.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workbook-cache.ts src/lib/workbook-cache.test.ts src/components/qa-workspace.tsx
git commit -m "perf: cache lazy project workbook downloads"
```

### Task 3: Guard Every Workbook Consumer

**Files:**
- Modify: `src/components/qa-workspace.tsx`
- Modify: `scripts/verify-workspace-navigation-cache.ts`

**Interfaces:**
- Consumes: `ensureWorkbookLoaded(): Promise<WorkbookSource>` from Task 2.
- Produces: workbook preview and export handlers that never parse an unloaded buffer.

- [ ] **Step 1: Extend regression checks**

Assert that the initial workspace call contains `{ includeWorkbook: false }`, export awaits `ensureWorkbookLoaded`, and sheet preview only renders `ResultSheetViewer` with `bufferLoaded === true`.

- [ ] **Step 2: Run regression test and verify RED**

Run: `npm run test:workspace-cache`

Expected: FAIL on missing lazy-load guards.

- [ ] **Step 3: Update consumers**

Before calling `readWorkbookSheet` or `exportTestCases`, await `ensureWorkbookLoaded`. For a sheet preview, show the existing shimmer during the lazy request. Google “โหลดจาก Sheets” already supplies a complete imported workbook and sets `bufferLoaded: true`.

- [ ] **Step 4: Verify list behavior and full build**

Run: `npm run test:workspace-cache && npm run typecheck && npm run lint && npm run build`

Expected: all commands exit 0. In browser Network tools, opening `/test-cases` must not request the Supabase Storage workbook; the first export/preview must request it once, and the second must make no additional workbook request.

- [ ] **Step 5: Commit**

```bash
git add src/components/qa-workspace.tsx scripts/verify-workspace-navigation-cache.ts
git commit -m "perf: lazy load workbook for previews and export"
```

