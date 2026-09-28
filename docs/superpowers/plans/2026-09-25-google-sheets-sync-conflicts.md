# Google Sheets Sync Conflicts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect changes made independently in Supabase and Google Sheets, present true conflicts for user resolution, and apply the chosen merged state without silent data loss.

**Architecture:** Normalize both stores into canonical snapshots and compare them against per-Test Case sync baselines. A server-side preview produces automatic merges and explicit conflicts; an idempotent apply operation revalidates hashes, writes both stores, and advances the baseline.

**Tech Stack:** Next.js 16.3.4 route handlers, React 19, TypeScript 5.9, Supabase/Postgres with RLS, Google Sheets API, Node test runner through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-25-google-sheets-sync-conflict-resolution-design.md`

## Global Constraints

- Never silently overwrite a value changed differently on both sides since the baseline.
- Test Case IDs are compared with the existing normalized identity rules and remain unique per project.
- Distinct stable Result and Defect IDs from both sides are preserved.
- Browser payloads never supply authoritative baseline or project data.
- Apply must reject stale preview hashes with HTTP 409.
- RLS must use existing project access/edit predicates; `TO authenticated` alone is insufficient.
- No write occurs when the user cancels the conflict dialog.

## Review Focus

- Case-only whitespace/casing differences must not create duplicate IDs while field values retain user formatting; Task 1 tests identifier normalization separately from values.
- Two users applying different decisions concurrently must cause the second apply to receive 409; Task 6 tests optimistic concurrency.
- Result IDs reused in different source sheets must remain distinct using the existing source-sheet identity; Task 2 tests composite child identity.
- Rename-to-keep-both must reject collisions introduced by another rename in the same request; Task 4 tests the complete rename set.
- Google write success followed by Supabase failure must be safely retryable without duplicating Results/Defects; Task 6 tests operation resume from `google_written`.

---

### Task 1: Canonical Sync Snapshots and Stable Hashes

**Files:**
- Create: `src/lib/sync/types.ts`
- Create: `src/lib/sync/canonical.ts`
- Create: `src/lib/sync/canonical.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `CanonicalProjectSnapshot`, `CanonicalTestCase`, `CanonicalResult`, `CanonicalDefect`.
- Produces: `canonicalizeCases(cases: TestCase[]): CanonicalProjectSnapshot`.
- Produces: `hashSnapshot(snapshot: CanonicalProjectSnapshot): string`.
- Produces: `canonicalCaseId(value: string): string` and `canonicalChildId(sourceSheetName: string | undefined, id: string): string`.

- [ ] **Step 1: Write failing canonicalization tests**

Tests must prove stable object-key ordering, preservation of field text, `TC05`/`TC-05` ID equivalence, composite Result identity, and identical hashes for semantically identical snapshots in different input orders.

```ts
test("normalizes identifiers without rewriting user values", () => {
  const snapshot = canonicalizeCases([caseFactory({ id: "tc05", remark: "  Keep spacing  " })]);
  assert.equal(snapshot.cases["TC-5"].remark, "  Keep spacing  ");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx tsx --test src/lib/sync/canonical.test.ts`

Expected: FAIL because the canonical module does not exist.

- [ ] **Step 3: Implement canonical types, sorting, and SHA-256 hashing**

Use Node `crypto.createHash("sha256")` over a recursively key-sorted JSON representation. Exclude row numbers, formulas, presentation metadata, and generated links.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx tsx --test src/lib/sync/canonical.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync package.json
git commit -m "feat: add canonical sync snapshots"
```

### Task 2: Three-way Diff and Automatic Merge Engine

**Files:**
- Create: `src/lib/sync/compare.ts`
- Create: `src/lib/sync/compare.test.ts`

**Interfaces:**
- Consumes: canonical types from Task 1.
- Produces: `compareSnapshots(baseline, local, remote): SyncPreview`.
- Produces: `SyncConflict` with `path`, `baseline`, `local`, `remote`, and `kind`.
- Produces: `ResolvedSnapshotDraft` containing automatic non-conflicting merges.

- [ ] **Step 1: Write failing three-way comparison tests**

Cover unchanged values, local-only changes, remote-only changes, equal concurrent changes, different concurrent changes, distinct child-ID union, same child-ID conflict, delete-versus-edit, and a new identical Test Case ID on both sides.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test src/lib/sync/compare.test.ts`

Expected: FAIL because `compareSnapshots` does not exist.

- [ ] **Step 3: Implement recursive field comparison with explicit deletion markers**

Represent absence with `{ kind: "missing" }` rather than `undefined` in serialized conflicts. Never auto-delete a baseline record when the opposite side edited it.

- [ ] **Step 4: Run canonical and comparison tests**

Run: `npx tsx --test src/lib/sync/canonical.test.ts src/lib/sync/compare.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/compare.ts src/lib/sync/compare.test.ts
git commit -m "feat: compare sync snapshots without data loss"
```

### Task 3: Supabase Baselines and Idempotent Operation Storage

**Files:**
- Create via CLI: `supabase/migrations/*_add_sync_conflict_state.sql` (use the exact path printed by `supabase migration new add_sync_conflict_state`)
- Create: `src/lib/sync/store.ts`
- Create: `src/lib/sync/store.test.ts`

**Interfaces:**
- Produces: `loadBaselines(projectId): Promise<CanonicalProjectSnapshot>`.
- Produces: `replaceBaselines(projectId, snapshot, actorId): Promise<void>`.
- Produces: `createSyncOperation(input): Promise<SyncOperation>` and `advanceSyncOperation(id, expectedStatus, nextStatus, error?): Promise<SyncOperation>`.

- [ ] **Step 1: Inspect current Supabase changelog/docs and CLI syntax**

Run `supabase --version`, `supabase migration new --help`, and review the current Supabase changelog for relevant Postgres/RLS breaking changes before generating the migration.

- [ ] **Step 2: Write failing store contract tests**

Use an injected repository adapter to test project-scoped reads, baseline replacement, unique `(project_id, testcase_key)` behavior, and compare-and-set operation transitions.

- [ ] **Step 3: Run and verify RED**

Run: `npx tsx --test src/lib/sync/store.test.ts`

Expected: FAIL because the store module and schema do not exist.

- [ ] **Step 4: Generate and implement the migration**

Use `supabase migration new add_sync_conflict_state`. Create `test_case_sync_baselines` and `project_sync_operations`, enable RLS, grant only required authenticated operations, and define select/write policies with `private.can_access_project(project_id)` and `private.can_edit_project(project_id)`.

- [ ] **Step 5: Implement the store adapter and verify**

Run: `npx tsx --test src/lib/sync/store.test.ts && supabase db lint --local`

Expected: tests PASS and database lint reports no new errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations src/lib/sync/store.ts src/lib/sync/store.test.ts
git commit -m "feat: persist sync baselines and operations"
```

### Task 4: Resolution Decisions and Duplicate-ID Renames

**Files:**
- Create: `src/lib/sync/resolve.ts`
- Create: `src/lib/sync/resolve.test.ts`

**Interfaces:**
- Consumes: `SyncPreview` from Task 2.
- Produces: `resolvePreview(preview, decisions): CanonicalProjectSnapshot`.
- Produces: `validateRenameSet(snapshotIds, decisions): RenameValidationResult`.
- Decision variants: `local`, `remote`, `merge-fields`, and `keep-both` with `renameSide` plus `newId`.

- [ ] **Step 1: Write failing decision tests**

Cover per-field selection, bulk local/remote selection, automatic child union, keep-both renaming of either side, collisions with existing IDs, collisions among two requested renames, and reference rewriting across Results/Defects.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test src/lib/sync/resolve.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement pure decision resolution**

Reject incomplete decisions and return path-specific validation errors. Keep the resolver side-effect free so preview and apply can reproduce the exact same result.

- [ ] **Step 4: Run all sync unit tests**

Run: `npx tsx --test src/lib/sync/*.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/resolve.ts src/lib/sync/resolve.test.ts
git commit -m "feat: resolve sync conflicts and duplicate IDs"
```

### Task 5: Server Preview Endpoint

**Files:**
- Create: `src/lib/sync/server.ts`
- Create: `src/app/api/projects/[projectId]/sync/preview/route.ts`
- Create: `src/app/api/projects/[projectId]/sync/preview/route.test.ts`
- Modify: `src/lib/google-sheets.ts`

**Interfaces:**
- Consumes: canonicalizer, comparator, baseline store.
- Produces: `buildSyncPreview(projectId, userId): Promise<SyncPreviewResponse>`.
- HTTP response includes `state`, `preview`, `localHash`, `remoteHash`, and `baselineHash`.

- [ ] **Step 1: Write failing route/service tests**

Test unauthenticated 401, unauthorized 403, first-sync behavior, all four visible sync states, and that authoritative data is loaded server-side rather than accepted from request JSON.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test 'src/app/api/projects/[projectId]/sync/preview/route.test.ts'`

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement project snapshot loaders and preview route**

Reuse existing Google parsing but expose a server-only method that returns `TestCase[]`. Authenticate with Supabase claims and verify project access before calling Google APIs.

- [ ] **Step 4: Run route and sync tests**

Run: `npx tsx --test src/lib/sync/*.test.ts 'src/app/api/projects/[projectId]/sync/preview/route.test.ts'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/server.ts src/lib/google-sheets.ts 'src/app/api/projects/[projectId]/sync/preview'
git commit -m "feat: preview Google Sheets sync conflicts"
```

### Task 6: Idempotent Apply Endpoint with Stale-preview Protection

**Files:**
- Create: `src/app/api/projects/[projectId]/sync/apply/route.ts`
- Create: `src/app/api/projects/[projectId]/sync/apply/route.test.ts`
- Modify: `src/lib/sync/server.ts`
- Modify: `src/lib/project-data.ts`
- Modify: `src/lib/google-sheets.ts`

**Interfaces:**
- Produces: `applySyncResolution(projectId, actorId, input): Promise<ApplySyncResult>`.
- Input contains `operationId`, preview hashes, and decisions only.
- Returns HTTP 409 with `code: "STALE_PREVIEW"` when local or remote hash changed.

- [ ] **Step 1: Write failing apply tests**

Test successful two-sided apply, stale local hash, stale remote hash, unauthorized editor, retry from `pending`, retry from `google_written`, and idempotent retry after `complete`.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test 'src/app/api/projects/[projectId]/sync/apply/route.test.ts'`

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement apply orchestration**

Re-fetch and hash both sides, resolve decisions using Task 4, persist the operation, write Google, persist workspace records, replace baselines, and advance operation state with compare-and-set transitions. Reuse stable IDs so retry cannot duplicate children.

- [ ] **Step 4: Run all server sync tests**

Run: `npx tsx --test src/lib/sync/*.test.ts 'src/app/api/projects/[projectId]/sync/**/*.test.ts'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/server.ts src/lib/project-data.ts src/lib/google-sheets.ts 'src/app/api/projects/[projectId]/sync/apply'
git commit -m "feat: apply sync decisions idempotently"
```

### Task 7: Conflict Resolution UI and Sync Status

**Files:**
- Create: `src/components/sync-conflict-model.ts`
- Create: `src/components/sync-conflict-dialog.tsx`
- Create: `src/components/sync-conflict-model.test.ts`
- Modify: `src/components/qa-workspace.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: preview/apply HTTP contracts from Tasks 5–6.
- Produces: a pure `createConflictDialogModel(preview, decisions)` view model and decision reducer that can be tested without a DOM dependency.
- Produces: `SyncConflictDialog` with per-field, bulk, merge, and keep-both decisions.
- Produces visible states: `Sync แล้ว`, `ยังไม่ Sync`, `Sheets มีข้อมูลใหม่`, `มี Conflict`.

- [ ] **Step 1: Write failing component behavior tests**

Test that identical/no-conflict preview does not render field choices, true conflicts require a decision, cancel calls no apply request, bulk selection fills all unresolved conflicts, duplicate ID keep-both requires a valid new ID, and 409 refreshes the preview with the Thai stale-data message.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test src/components/sync-conflict-model.test.ts`

Expected: FAIL because the dialog does not exist.

- [ ] **Step 3: Implement the dialog and replace direct load/sync writes**

Both “โหลดจาก Sheets” and “ซิงค์กลับ Google Sheets” request preview first. Render side-by-side baseline/system/Google values, keep the primary recommendation on merge, and call apply only after all required decisions validate.

- [ ] **Step 4: Run component, sync, lint, and type tests**

Run: `npx tsx --test src/components/sync-conflict-model.test.ts src/lib/sync/*.test.ts && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/sync-conflict-model.ts src/components/sync-conflict-model.test.ts src/components/sync-conflict-dialog.tsx src/components/qa-workspace.tsx src/app/globals.css
git commit -m "feat: add sync conflict resolution UI"
```

### Task 8: End-to-end Verification and Rollout Safety

**Files:**
- Create: `scripts/verify-sync-conflicts.ts`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes all prior tasks.
- Produces: `npm run test:sync-conflicts` integration command.

- [ ] **Step 1: Create an integration fixture and failing verification script**

The script builds baseline/local/remote fixtures including duplicate `TC-05`, applies merge and keep-both decisions, writes a temporary workbook representation, parses it back, and asserts canonical equality.

- [ ] **Step 2: Run and verify RED before wiring final adapters**

Run: `npm run test:sync-conflicts`

Expected: FAIL until the complete adapters are connected.

- [ ] **Step 3: Complete adapter wiring and document user workflow**

Document status meanings, preview behavior, duplicate-ID choices, stale-preview handling, retry behavior, and the fact that cancel writes nothing.

- [ ] **Step 4: Run complete verification**

Run: `npm run test:sync-conflicts && npm run test:workspace-cache && npm run typecheck && npm run lint && npm run build`

Expected: every command exits 0. Also run the Supabase migration/RLS verification against the configured development project and confirm a viewer cannot apply while an editor can.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-sync-conflicts.ts README.md package.json
git commit -m "test: verify conflict-safe Google Sheets sync"
```
