# Personal Test Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not delegate unless the user selects delegation.

**Goal:** Show accurate per-tester Sprint outcomes, including Sheets data, and persist bulk case responsibility for unstarted work.

**Architecture:** A pure aggregator consumes paginated saved case/result metadata, origin records and case assignments. A scoped assignment RPC validates Project editing rights and eligible QA accounts. A separate dashboard table owns filters, expansion and status drill-down; existing Sprint summary and provenance remain unchanged.

**Tech Stack:** Existing Next.js App Router, TypeScript, React, Supabase PostgreSQL, node:test/tsx and PGlite migration tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-personal-test-performance-design.md`

## Global Constraints

- Read relevant local Next.js guides in `node_modules/next/dist/docs/` before implementation.
- Users run Supabase SQL themselves. Do not apply remote migrations, delete real data, commit or push without a separate request.
- Project-level QA assignment is not automatically copied to every case.
- Do not rewrite historical origin records to fabricate authors.
- Do not collapse separate source rows that share a TC identifier.
- Missing migration/query failures show an error, not misleading zero counts.

## Review Focus

1. Ambiguous Sheets tester names must not resolve to an arbitrary account.
2. A repeated result/retained execution snapshot must not inflate case counts.
3. Missing/invalid dates need deterministic fallback, never an Invalid time value exception.
4. Cross-Project case IDs and unauthorized assignment must be rejected atomically.
5. Moved Projects retain known-origin contributions; unknown-origin imports remain visibly inferred.

### Task 1: Pure personal outcome model

**Files:** Create `src/lib/personal-test-performance.ts` and `.test.ts`; modify `src/lib/types.ts` only for shared persisted tester identity.

**Interfaces:**
- `PersonalCase`: `{projectId, projectName, caseId, caseName, sourceRowKey, detailPath, assignedUserIds, results}`.
- `PersonalResult`: `{id, testerId?: string, testerName: string, status: string, source: 'web'|'sheets', sourceSheet: string, recordedAt: string, order: number, originSprintId?: string, inferred: boolean}`.
- `buildPersonalPerformance({sprintId, members, cases, projectAssignments, filters})` produces rows with person identity, project count, tested/pass/failed/inProgress/skip/notStart counts and case-level entries for drill-down. Filters: optional projectId/testerKey/source. Preserve source-row identity in case keys.
- Tester resolution prioritizes trusted persisted identity; otherwise exact normalized email, then unique normalized name. Unknown nonblank source names retain separate unresolved identities. Blank names form a clearly labeled unknown-tester row.

- [ ] Add tests: one tester's Fail then Pass is one Pass; two testers remain separate; two source rows referencing TC-18 remain separate; repeated IDs deduplicate; invalid timestamps use saved order; status aliases normalize.
- [ ] Add tests: exact email resolves, ambiguous name stays unresolved, importer is never credited; inferred imported result appears with source notice; known origin stays in original Sprint after move.
- [ ] Add tests: no assignment yields unassigned Not Start; two assignees each have pending work; started result overrides pending for that tester; Project assignment alone assigns no cases; filters also constrain expanded entries.
- [ ] Run `node --import tsx --test src/lib/personal-test-performance.test.ts` and confirm failures before implementation.
- [ ] Implement aggregation and rerun until all specified assertions pass.

### Task 2: Persistent case assignments and assignment actions

**Files:** New migration generated with `supabase migration new personal_test_performance`; extend `src/lib/planning-migration.test.ts`; modify `src/app/planning-actions.ts`; create `src/lib/case-assignments-server.ts`.

**Interfaces:**
- Assignment records keyed by `(test_case_id, user_id)` reference saved test cases and auth users; derive Project from the case rather than accepting mutable duplicated Project ownership. Store assigned_by and assigned_at. Deletion cascades with the case.
- Scoped RPC `set_test_case_qa(requested_project_id uuid, requested_case_ids uuid[], requested_user_ids uuid[])` replaces assignees for selected cases atomically; empty user list clears assignments. Private implementation plus public invoker wrapper, explicit grants and RLS following existing migration patterns.
- Server action `setTestCaseQa(projectId: string, caseIds: string[], userIds: string[]) -> {error?: string}` requires existing Project edit capability and revalidates affected Project/Sprint views.
- Read action `getTestCaseAssignments(projectId: string)` returns persisted case IDs, assignees and eligible people; requires Project view capability. Resolve UI source row keys to persisted records server-side; never silently assign aliases to a different source row.

- [ ] Test permission denial, wrong-Project case IDs, inactive users, nonmembers, multiple users, replacement/clear, duplicate inputs and empty selection. Confirm transaction does not partially update on invalid input.
- [ ] Run PGlite migration tests and capture failing assertions before implementing schema/actions.
- [ ] Implement rerunnable migration, grants, RLS and actions; preserve historical assignments but disallow new assignments to revoked/inactive users. Follow existing eligible member authorization helpers rather than user_metadata.
- [ ] Verify privileged functions are private and public wrappers do not expose unrestricted writes; run isolated migration tests. Do not execute SQL remotely.

### Task 3: Saved metadata loader and explicit tester persistence

**Files:** Modify `src/lib/planning-server.ts`, `src/lib/project-data.ts`, `src/lib/types.ts`, `src/components/qa-workspace.tsx`; add focused loader/serialization tests.

**Interfaces:**
- `loadPersonalPerformance(groupId, sprintId)` returns serialized input for Task 1 or explicit error.
- Add `personalPerformance` data to `loadSprintDashboard` output without changing existing `team`/Project assignment behavior relied on by management controls.
- Load all saved cases/execution metadata and relevant origin Sprint records using `readAllRows`; select no evidence blobs and call neither Google Sheets nor workbook/image loaders.
- Persist tester name/identity per newly saved Result, preserving fields on edits. For legacy records use saved executed_by and clearly inferred fallback, never assign every historic Result to the latest case editor. Use a trusted server-side identity when claiming a user ID.

- [ ] Add tests for API page boundaries, duplicate execution snapshots, no image/workbook calls, failed query propagation, custom EXECUTED BY extraction and old payload compatibility.
- [ ] Implement loader and serialization; assert imports with saved tester text show rows even if group membership is empty.
- [ ] Verify moved-out known-origin contributions can resolve case detail links; unknown origins are current-Sprint/inferred only.

### Task 4: Personal table, status drill-down and bulk assignment UI

**Files:** Create `src/components/personal-test-performance.tsx` and `src/components/test-case-assignment-dialog.tsx`; modify `src/components/sprint-dashboard.tsx`, `src/components/qa-workspace.tsx`, `src/app/globals.css`.

**Interfaces:**
- `PersonalTestPerformance({data, groupId, compact})`: filters for Project/person/source; expandable per-person Project rows; status buttons open matching detail list with existing Test case/sheet routes. Use stable source row detail paths, not bare TC identifiers.
- `TestCaseAssignmentDialog({projectId, selectedCaseIds, onClose, onSaved})`: eligible QA selector, explicit replace/clear confirmation and pending/error states. Parent list owns selection and updates after save.

- [ ] Replace only the old team contribution table. Show all requested columns and colors, inferred-source notice, unknown tester labels and explanation of overlapping multi-person totals.
- [ ] Add selection controls and bulk assignment action on the Test cases list only for Project editors; stop row navigation when interacting with checkboxes. Show current assignees separately from actual tester. Unsaved/unresolvable source rows must show a clear save/import requirement, not silently disappear from assignment.
- [ ] Verify expansion, zero-count buttons, filters, source-specific detail links, keyboard dialog controls, narrow-screen horizontal table scrolling and no layout overflow.
- [ ] Verify Cancel performs no assignment and invalid input exposes action error. Do not mutate actual production/group data during UI verification.

### Task 5: Final verification and SQL handoff

- [ ] Run `node --import tsx --test src/lib/*.test.ts src/lib/sync/*.test.ts`; all tests must pass, including new aggregation and isolated permission cases.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`; record actual outputs before claiming completion.
- [ ] Review all changed interfaces against the spec and preserve unrelated dirty files.
- [ ] Provide the exact generated migration path for user-run SQL, note changes are not remotely applied, and explain any still-unverified live UI behavior. Do not commit/push unless separately asked.
