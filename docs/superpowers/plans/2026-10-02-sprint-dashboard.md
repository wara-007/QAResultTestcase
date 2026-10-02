# Sprint Dashboard Implementation Plan

> **For agentic workers:** Execute natively using superpowers:executing-plans. Do not delegate or push.

**Goal:** Deliver Sprint editing, multi-QA responsibility, immutable move snapshots and original-Sprint Result contributions in the approved Dashboard.

**Architecture:** PostgreSQL triggers own provenance and move snapshots, independent of UI/import writes. Read-only ledgers are protected by RLS. Server actions validate permissions and concurrency. Dashboard composes stored project status and historical Result contribution separately.

**Tech Stack:** Existing Next.js/TypeScript, Supabase PostgreSQL, PGlite tests, Lucide and existing CSS.

**Spec:** ../specs/2026-10-02-sprint-dashboard-design.md

## Global Constraints
- No remote database writes or push; preserve existing unstaged changes.
- Multi-QA assignments are responsibility, not authorization.
- Legacy/import data is inferred, never credited to importer.
- No duplicate Project counts; preserve Result origin through edits/moves.

## Review Focus
- Moves racing with result saves: lock Project before stamping origin or snapshot.
- Repeated moves and return to same Sprint: retain every event, exclude current projects from moved-out list.
- Legacy/malformed JSON and missing author: safe empty counts and explicit inferred labels.
- Unauthorized direct Data API writes: read-only ledgers; guarded functions and trigger scope.
- Multiple PO recipients: pending precedence and approved/total counts, no false all-approved.

### Task 1: Database provenance and move history
Files: new SQL migration, src/lib/planning-migration.test.ts.
- [ ] Write PGlite tests for origin stamping, edit after move, atomic snapshot/reason, multiple QA assignment guards, Sprint updates, immutable audits.
- [ ] Run failing tests before migration implementation.
- [ ] Implement SQL, backfill inferred origins, guarded assignment/Sprint RPCs and grants/RLS.
- [ ] Run PGlite tests until green.

### Task 2: Dashboard data and server actions
Files: src/lib/sprint-dashboard.ts + test, planning-server.ts, planning-actions.ts, project-data.ts, types.ts, project-management.tsx.
- [ ] Write tests for moved-out filtering, contributions vs current metrics, duplicate result/case/project counts, no imported author credit, attention and filters.
- [ ] Run failing tests; implement pure aggregation and secure paginated loaders/actions.
- [ ] Expose QA assignment and move reason form, persisted Result origin labels.
- [ ] Run tests/typecheck.

### Task 3: Approved screen and verification
Files: sprint-dashboard.tsx, planning-home.tsx, Sprint page, globals.css, README.
- [ ] Implement selected layout using existing components/icons and real data; URL-preserved navigation, filters, edit modal and history.
- [ ] Run all test suites, lint, typecheck, production build and diff check.
- [ ] Inspect browser at selected viewport; if migration not run, record visual/live verification as blocked rather than injecting mock data into production.

## Execution ledger
- Ruling: Existing dirty working tree remains the implementation workspace; no unrelated checkout/commits. User approved continuation of existing work.
- Ruling: Full production behavior was requested; reuse existing app instead of scaffolding a prototype.
- Tasks 1 and 2 implemented: migration tests went from failing to green; immutable origin, move snapshots, assignment permissions, concurrent Sprint editing, aggregation and paginated data loaders covered.
- Task 3 implemented: selected dashboard layout, team/history URL views, search, QA filter, Project rows, edit dialogs and origin labels. Visual/live verification remains blocked by missing production migrations; see design QA report.
- Automated suite: 73 tests passed, including PGlite migration tests and pagination boundaries. Navigation cache and read-only workspace regression scripts passed.
- Build initially exposed generic RPC row typing issues after pagination; corrected and rerun before handoff. No commit, push, remote migration or unrelated cleanup performed.
