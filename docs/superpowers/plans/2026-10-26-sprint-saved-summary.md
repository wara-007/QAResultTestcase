# Sprint Saved Summary Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for implementation and request an independent review before completion. Work in the existing dirty checkout to preserve the in-progress Sprint fix; do not commit, push or deploy.

**Goal:** Opening Sprint overview reads Cover metadata and saved numeric summaries, never all case result/log payloads. Detailed performance loads only after explicit navigation.
**Architecture:** Store a compact, validated counts snapshot in source_files.column_mapping.dashboardSummary with a server timestamp/token. Reuse existing xmin CAS helper and project edit authorization. Generate snapshots from canonical stored project cases after import/save; legacy snapshots are seeded when an editor opens the project and may be backfilled once for the affected Sprints. Unknown summaries remain visibly unknown. Lightweight overview reads latest source per project through a bounded nested relation, team/QA/approval metadata and frozen participation headers; personal performance remains lazy.
**Tech Stack:** Existing Next16/React, authenticated Supabase clients, existing source metadata; no new schema, packages or Storage objects.

- [x] Add failing tests for canonical saved counts/defect precedence, strict validation and lightweight overview query boundary.
- [x] Implement summary model, authenticated CAS persistence endpoint and project save/import hooks. Cache failures must not pretend the underlying case save failed.
- [x] Add light overview reader; use heavy detail reader only on requested team/activity views; retain history and paginated project list.
- [x] Display Cover metadata and saved-at/unknown states without publishing partial totals as full totals.
- [x] Backfill affected project snapshots from stored data when authorized/readable; never refetch Sheets or upload evidence for backfill.
- [x] Verify full tests/lint/build and live overview without test_cases/result payload requests; independent review.

Accepted user scope: Cover for project context; persisted application summary for accurate numbers; full cases/images/logs on detail access. This plan records the already approved direction and does not require another approval round.


## Verification — 2026-10-26

- Canonical summary/query-boundary tests observed failing before implementation, then passing.
- Full suite: 668 passed, 0 failed. ESLint and production build (including TypeScript) passed.
- Navigation-cache and read-only regression scripts passed; git diff --check clean.
- One independent review found stale-summary retry, missing batch refresh hooks, and source/token ordering issues. Fixed all, including memoizing the PostgREST thenable; added a source-before-case single-read regression.
- Backfill dry-run and apply completed for the 8 projects in the two affected Sprints using stored rows only. CORE: 81 cases (71 Pass, 1 Failed, 8 Skip, 1 Not Start); Payment: 112 cases (95 Pass, 17 Skip).
- Authenticated local browser: both overview totals matched; CORE team detail and history views opened; no console errors on the checked overview pages.
- No schema changes, Storage uploads, commits, push or deployment. Browser evidence: /tmp/qa-sprint-saved-summary-2026-10-26.png.
