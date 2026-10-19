# Project Sprint Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user chooses delegation. Implement task-by-task using the checkboxes below.

**Goal:** Keep one Project visible in every Sprint it participated in, with frozen historical detail and a single editable current workspace.

**Architecture:** Retain `projects.sprint_id` as the active Sprint. Add participation episodes, immutable snapshot headers/cases, and protected snapshot reads. Reuse existing Preview renderers; combine current Project rows with historical snapshot rows for Sprint reporting without duplicating current data or media.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Supabase/Postgres, PGlite tests, node:test/tsx; existing Drive/R2 evidence adapters.

**Spec:** `docs/superpowers/specs/2026-10-18-project-sprint-continuation-design.md`

## Global Constraints

- One Project ID and one active Sprint per Project; no copied Test cases, Google Sheets or media binaries.
- Historical views are read-only and never fetch live Google Sheets as a substitute for missing snapshot data.
- Snapshot capture, closing/opening episodes, updating the active Sprint and audit history are one database transaction.
- Preserve existing Project capabilities and Group boundaries; validate all Project/Sprint/participation identifiers server-side.
- Preserve Result origins and PO decisions; continuation does not reset Approval or reassign authorship.
- Legacy history is summary-only unless detailed historical data actually exists; never fabricate past Results from current Results.
- Prepare migration SQL for the user to run. Do not execute remote SQL, push, deploy or commit unrelated work automatically.
- Work in the existing checkout while preserving unrelated changes. Read the relevant bundled Next.js guides before route/component edits.
- No new dependency is needed. Use `apply_patch` for edits and `node --import tsx --test` for tests.

## Review Focus

1. Returning to the same Sprint must show one Project row while retaining earlier episodes (Tasks 1, 4).
2. Concurrent continuation/Result writes must not split provenance or leave an incomplete snapshot (Task 2).
3. Historical images must survive deletion of a current Result and remain permission-checked (Task 6).
4. Missing old detail must not silently display current Results under an old Sprint heading (Tasks 3, 5).
5. Frozen historical personal outcomes must survive later Result edits/deletes without double-counting carried-in work (Task 7).

## File / Interface Map

- `src/lib/project-sprint-participation.ts`: shared types and pure row selection.
- `src/lib/project-sprint-snapshot.ts`: pure snapshot conversion/validation; imports shared types only.
- `src/lib/project-sprint-history-server.ts`: permission-checked paged database reads.
- `supabase/migrations/<CLI-generated>_project_sprint_continuation.sql`: episodes, snapshots, grants, RLS, atomic trigger and backfill.
- `src/app/planning-actions.ts`: existing management action with schema readiness and actionable errors.
- `src/lib/planning-server.ts`, `src/lib/sprint-dashboard.ts`: current plus historical Sprint data.
- `src/components/sprint-dashboard.tsx`, `src/components/qa-workspace.tsx`: list integration only; keep snapshot logic in dedicated files.
- `src/components/sprint-project-list.tsx`: shared current/historical row presentation and filters.
- `src/components/project-sprint-snapshot-view.tsx`: immutable Project history with paged case previews.
- New nested history page/API/evidence routes under Sprint/Project/participation identifiers.
- `src/lib/evidence-cleanup.ts`, `src/app/actions.ts`: retain snapshot references and clean all evidence on true Project deletion.

Shared exported contracts (Task 1 owns these types):

```ts
type Participation = {
  id: string; projectId: string; sprintId: string;
  enteredAt: string | null; exitedAt: string | null;
  previousId: string | null; nextId: string | null;
  actorName: string; reason: string;
  snapshotKind: 'full' | 'legacy-summary' | 'none';
};
type SnapshotHeader = {
  version: 1; participation: Participation;
  project: Pick<Project, 'id' | 'name' | 'description' | 'environment'>;
  counts: MoveSnapshot; qa: PlanningTeamMember[];
  approval: ApprovalTotals; source: Omit<WorkbookSource, 'buffer' | 'bufferLoaded'> | null;
};
type SnapshotCase = { snapshotId: string; position: number; testCase: TestCase };
type SprintProjectEntry = {
  projectId: string; sprintId: string; name: string;
  kind: 'current' | 'continued'; participationId: string;
  destination: { sprintId: string; sprintName: string; year: number } | null;
  historical: SnapshotHeader | null;
};
```

### Task 1: Episode selection and snapshot contracts

**Files:** Create `src/lib/project-sprint-participation.ts`, `src/lib/project-sprint-snapshot.ts` and matching `.test.ts` files.

**Interfaces:** Produce the contracts above, `selectSprintProjectEpisodes(sprintId: string, episodes: Participation[]): Participation[]` and `snapshotCaseFromStored(row: StoredCaseInput): TestCase`. `StoredCaseInput` contains the same register fields and latest execution fields used in `project-data.ts`; share the existing stored-result parser rather than implementing a second JSON interpretation.

- [ ] Write failing tests: A → B → A selects one active A episode and retains the first closed episode for history; A → B → A → C selects A's latest exit, not both exits. An unrelated Project cannot replace another row.
- [ ] Write failing snapshot tests: preserve Steps, Highlights, source fields, shared Results, evidence references, Defects, dates and test data; legacy-summary never generates full cases.
- [ ] Run `node --import tsx --test src/lib/project-sprint-participation.test.ts src/lib/project-sprint-snapshot.test.ts`; confirm red for the intended missing behavior.
- [ ] Implement pure selection using Project ID and episode chronology, preferring the active episode. Keep all episodes available for a separate history selector.
- [ ] Implement stored-case conversion using existing parsing rules, with explicit `version: 1` snapshot validation; do not include buffers/tokens in headers.
- [ ] Run the focused tests; require all green and unchanged input fixtures.

### Task 2: Database-owned atomic episodes and snapshots

**Files:** Create CLI-generated migration, `src/lib/project-sprint-migration.test.ts`; modify `src/app/planning-actions.ts` only for readiness/error handling.

**Interfaces:** Database tables `project_sprint_participations`, `project_sprint_snapshots`, `project_sprint_snapshot_cases`; public readiness RPC `project_sprint_continuation_ready() -> boolean`. Preserve `updateProjectDetails(input)` signature and `expectedUpdatedAt` conflict contract. The existing Project history trigger remains the owner of continuation capture, so direct permitted Project updates cannot bypass it.

- [ ] Read Supabase skill and current docs before database work. Discover CLI via `npx supabase --help`, then `npx supabase migration --help`; generate `project_sprint_continuation` with the supported command and use the returned filename throughout tests.
- [ ] Build a PGlite fixture based on `planning-migration.test.ts`; write failing executable SQL tests for one active episode, atomic close/snapshot/open, stale version, wrong Group, viewer denial and snapshot mutation denial.
- [ ] Add a failure injection test in snapshot insertion; assert old active Sprint and history remain unchanged after rollback. Add a Result-write/continuation locking test using a local Postgres integration fixture if PGlite cannot represent concurrent sessions; do not claim concurrency is verified by a sequential test.
- [ ] Implement rerunnable tables/indexes, Project/Sprint foreign keys and cascading true-Project deletion. Restrict writes to database-owned capture; enable RLS and grant only necessary read/RPC access.
- [ ] Extend the existing capture trigger: capture OLD Project metadata, current saved cases/Results/assignments/approval/source metadata, then close the old episode and open the new episode under the existing Project row lock. Preserve the existing audit event/origin behavior without duplicate trigger entries.
- [ ] Keep the existing `updated_at` compare-and-set. Reject transfers with persisted loading/queued import states; treat completed rows with a stale aggregate flag correctly. Reject partial capture rather than truncate oversized content.
- [ ] Backfill current episodes and legacy summary episodes idempotently from existing history IDs. Unknown dates/actors remain unknown; details are absent, not copied from current records.
- [ ] Add readiness check only when Sprint changes; missing schema yields “ยังไม่ได้ติดตั้งระบบทำต่อข้าม Sprint กรุณารัน migration ก่อน”. Same-Sprint metadata edits continue to work.
- [ ] Run PGlite/integration tests including rerunning the migration twice; inspect security grants and function privileges. Do not apply it to the user's remote database.

### Task 3: Protected historical reads and lookup

**Files:** Create `src/lib/project-sprint-history-server.ts`, `src/lib/project-sprint-history.test.ts`, API routes under `src/app/api/projects/[projectId]/sprint-history/[participationId]/`.

**Interfaces:** `loadProjectSprintHistory({projectId, sprintId, participationId, offset, limit}): Promise<{header: SnapshotHeader; cases: SnapshotCase[]; total: number}>`; default page size 10, max 50. List reads return headers only. Routes require authenticated existing Project view capability and matching participation/Sprint, regardless of client-supplied IDs.

- [ ] Write failing tests: viewer with Project access may read a full snapshot; stranger/wrong Sprint/wrong Project cannot. Legacy header returns empty details with `legacy-summary`, not live cases.
- [ ] Add test that header/list query does not select snapshot case bodies and paged details are deterministically ordered by position then ID.
- [ ] Implement server loader and GET API with stable pagination; avoid Google API calls and avoid exposing provider tokens. Read failures stay explicit and retryable.
- [ ] Run tests for offsets, out-of-range pages, missing snapshots and protected routes; require correct 401/403/404 outcomes with no cross-Project data.

### Task 4: Unified Sprint lists and aggregate reporting

**Files:** Modify `src/lib/planning-server.ts`, `src/lib/sprint-dashboard.ts`, `src/components/sprint-dashboard.tsx`, `src/components/qa-workspace.tsx`, Sprint Projects route; create `src/components/sprint-project-list.tsx` and tests.

**Interfaces:** Add `entries: SprintProjectEntry[]` to dashboard data without changing the meaning of existing current `projects`. New `filterSprintProjectEntries(entries, {query, qaId, scope})`, where scope is `all | current | continued`. List building consumes Task 1 selection and Task 3 header reads.

- [ ] Write failing tests: Project A in Sprint 67 remains in the main table after continuation to 68; both Sprint views link to one Project identity but old view uses the episode history route.
- [ ] Add tests for query/QA filtering and pagination across both row kinds, same-Sprint re-entry, deduplicated global Project totals and no duplicate moved-out section.
- [ ] Implement a discriminated row presenter: current rows use stored live status/capabilities; continued rows use frozen header counts/QA/approval and show “ทำต่อใน Sprint …”. Current carried-in rows show “ต่อจาก Sprint …”.
- [ ] Combine live and selected historical counts into Sprint totals. Show active/continued counts separately. Keep live attention queues separate from historical exit statuses.
- [ ] Use the presenter in Dashboard and Sprint Projects. Do not pass historical rows into `QaWorkspace` as editable `Project` objects; route them to Task 5 instead. Replace the moved-out-only section with main-list entries.
- [ ] Run domain and SSR component tests; verify the existing Project search/counts and management permissions still work.

### Task 5: Read-only historical Project and case preview

**Files:** Create `src/components/project-sprint-snapshot-view.tsx`, tests, and `src/app/groups/[groupId]/years/[year]/sprints/[sprintId]/projects/[projectId]/history/[participationId]/page.tsx`; reuse `test-case-preview.tsx` without mutation callbacks.

**Interfaces:** URL optionally carries `?case=<id>&page=<n>`. Page loads Task 3 header/case data and never invokes live `QaWorkspace` import/load effects. `ProjectSprintSnapshotView({header, cases, total, page, currentHref})` receives no save/sync/approval functions.

- [ ] Write failing tests: history has a prominent frozen date/source/destination banner; no edit/sync/submit/map controls; legacy summary shows “ข้อมูลย้อนหลังแบบสรุป” and explicitly missing details.
- [ ] Add test that `?case` and pagination remain within the same participation and that “เปิดงานปัจจุบัน” is the only intentional live-workspace navigation.
- [ ] Implement archived Overview/Cover/QA/Approval summary, searchable case list and reused read-only case/results/media presentation; provide loading placeholders, retry and unavailable-media states.
- [ ] Add optional `evidenceBasePath` to `TestCasePreview` with existing Project evidence path as default; history passes Task 6's protected endpoint. Do not add live-result fallback on empty archives.
- [ ] Run tests and verify Next route type/build. Check refresh, back navigation and multiple source rows for one Test case.

### Task 6: Snapshot-aware evidence retention and Project deletion

**Files:** Create `src/lib/snapshot-evidence.ts`, `src/lib/snapshot-evidence-server.ts`, tests and history evidence GET route; modify `src/app/actions.ts`, evidence/source cleanup call sites identified during execution.

**Interfaces:** `collectSnapshotEvidence(cases: SnapshotCase[]): TestEvidence[]` deduplicates file IDs/object keys. `isEvidenceReferencedBySnapshot(projectId, evidence): Promise<boolean>` is a server-side retention check. Evidence GET accepts Project/participation/file IDs and resolves the stored matching reference, never an arbitrary upstream URL supplied by the request.

- [ ] Write failing tests: current Result deletion cannot remove an archived file; two snapshots sharing one file do not duplicate the binary; unauthorized history-media requests fail.
- [ ] Add tests for legacy Drive, R2, external evidence and archived source-workbook references. Use existing image/video viewer adapters; no provider file deletion on continuation.
- [ ] Implement retention checks at actual cleanup boundaries, preserving immutable source versions referenced by snapshots. If cleanup state is uncertain, retain and report rather than delete.
- [ ] Extend true Project/Group deletion to collect references from current and all snapshot payloads before cascading database rows, then use existing provider cleanup/warning behavior. Never delete Google Sheets originals.
- [ ] Run evidence/cleanup tests; verify archived files no longer referenced are only removed through the authorized lifecycle.

### Task 7: Frozen personal work and carried-in result labels

**Files:** Modify `src/lib/personal-register-cases.ts`, `src/lib/personal-test-performance.ts`, `src/lib/planning-server.ts`, `src/components/personal-test-performance.tsx`; create `src/lib/sprint-result-scope.ts` and tests; adapt Result origin labels in dedicated presentation helpers rather than expanding inline workspace logic.

**Interfaces:** `classifySprintResult(result, currentSprintId, baselineResultKeys): 'current' | 'carried' | 'unknown'`. Snapshot outcomes are converted to the existing `PersonalCase` contract and filtered by true origin, without changing their original author or date.

- [ ] Write failing tests: Sprint 67 work remains after deleting/editing its live Result in 68; new work in 68 is credited to 68; copied/shared result references and repeated episodes do not inflate one person's outcomes.
- [ ] Add tests for unknown/inferred imported origin, unnamed Skip, changed tester names, case assignments versus Project assignments and cases with no detailed Results.
- [ ] Implement archived personal-performance input from snapshots for closed episodes and live input for active episodes, keeping distinct source rows and latest per-person semantics.
- [ ] Show carried-in/current/unknown labels from recorded origins and entrance baseline; do not infer new work merely because an import happened in this Sprint. Preserve Approval decisions and avoid altering status calculation.
- [ ] Run personal/report/origin tests and verify activity links point to the correct frozen episode or current workspace.

### Task 8: Rollout guide and end-to-end acceptance

**Files:** Create `docs/project-sprint-continuation-setup.md`; extend relevant integration tests and browser verification fixtures.

**Interfaces:** Setup guide references the exact CLI-created migration path from Task 2, installation checks and rollback limitations. No remote database action is performed without user authorization.

- [ ] Write a local integration fixture with 67/68/69, two QA, shared results, unnamed Skip, a defect, approved PO, image/video references and legacy summary history.
- [ ] Run the spec's twelve acceptance checks, including failed capture, re-entry, unauthorized archived access and deletion retention. Exercise actual SQL, not assertions on SQL text alone.
- [ ] Run `rg --files src -g '*.test.ts' -g '*.test.tsx' | xargs node --import tsx --test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Require no test failures or compiler/linter errors; report environment warnings separately.
- [ ] Verify browser flow: continue 67 → 68, old list still contains Project, archived details are immutable, current changes do not modify old results, search/pagination and image viewer work, refresh preserves episode URL. If the configured browser is unavailable, state this verification gap rather than claim visual completion.
- [ ] Deliver the SQL file and concise setup steps for the user to run. Check the installed schema after the user confirms; keep continuation gated until installed.
- [ ] Request one final independent review using the execution method approved by the user. Do not push/deploy or include unrelated changes in commits without authorization.

## Self-review

- Coverage: episode/backfill/concurrency = Tasks 1–2; protected queries/legacy limits = Task 3; lists/counters = Task 4; immutable UI = Task 5; evidence lifecycle = Task 6; personal outcomes/origins/Approval preservation = Task 7; rollout/full verification = Task 8.
- Runtime names, type properties, route IDs and RPC readiness name are consistent across tasks.
- Existing Project IDs, group access, previous dirty changes and external Sheets remain untouched by the design.
- Execution has not started. The user must review this written plan and choose native or delegated execution before implementation.
