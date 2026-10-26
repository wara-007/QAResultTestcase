# Pre-push review fixes implementation plan

> Use superpowers:subagent-driven-development with bounded independent file ownership; root handles integration. User authorized fixing all eight confirmed findings in the current dirty working tree. No commits, pushes, live mailbox sends, Sheets writes or Storage deletes.

**Goal:** Resolve all findings in docs/qa-prepush-code-review-2026-10-26.md without losing existing working-tree changes.
**Architecture:** Preserve independent register rows and authoritative exact Ref targets; retain full sync payloads; persist source provenance and revision; classify uncertain mail sends safely; handle baseline limits before partial persistence.
**Tech:** Existing Next16/TypeScript/Supabase/Google APIs; no new packages or schema changes unless demonstrated necessary.

## Tasks

- [x] A: Add failing duplicate-definition/reordered-Ref tests; fix one-to-one identity reconciliation while preserving Ref edits and existing URLs. Files register-case-identity.ts + tests only.
- [x] B: Add failing exact-tab/mixed-noRef/defect-custom-field sync tests; fix Ref matching and safe sync destinations/payloads. Own sheet-mapping-model/resolution, register-result-write-plan, google-sheets, step-sheet-sync/results and associated tests. Preserve snapshot round trips, source sheets/images/formulas; no live writes.
- [x] C: Add failing manual-upload-checkpoint origin tests, Gmail timeout uncertainty tests, and2000/2001 baseline tests. Persist immutable sourceOrigin metadata, require explicit Sheets origin for generic cleanup; classify unknown Gmail outcomes; ensure large import cannot fail solely at final checkpoint. Own source-workbook-storage, project-data, types.ts, source-storage-cleanup, sheet-refresh/import-state, approval-email/google-mail and tests. Coordinate if limits need route/schema updates.
- [x] Root: Add failing revision-bound detail-source tests; capture/check source revision on both partial import paths and integrate origin metadata. Own qa-workspace.tsx, revision-checked-workbook helpers/endpoint if needed, .gitignore; do not delete nested repository.
- [x] Fresh task reviews and integration corrections.
- [x] Full suite, lint, typecheck/build, read-only/navigation checks, final independent review and update finding status.

## Constraints and rulings

- Work in place because the findings concern the large existing uncommitted patch; creating a clean worktree would omit that baseline. Do not reset or rewrite other changes.
- Ref edits must not unnecessarily create a new case; distinct refs break ties among otherwise identical duplicate definitions.
- Normalized tab fallback may only select one unambiguous target; resolved exact titles must not collapse punctuation.
- No-Ref untouched cases must not require result tabs; cases with unsynced results need a safe destination.
- Do not discard web defects/custom fields when writing safe result snapshots.
- Unknown source origin stays held by generic cleanup; the explicit one-off already-approved cleanup scripts remain separate.
- Capture revision from the same workbook bytes: content-hash revisions may verify bytes directly; Drive revisions require before/after checks.
- Keep local uploads durable even when project has a Sheets link.
- Ignore /QAResultTestcase/ for parent staging; retain the directory and its Git metadata.

## Integration notes

- Fresh task review caught Ref exchanges overriding distinct unchanged definitions; a definition reservation pass and regression now cover it.
- Safe register execution parity now includes Test data and preserves formula cells.
- Workbook endpoint supports an expected revision for transient detail downloads; client caches are keyed by revision, and upload/unknown-origin bytes cannot masquerade as Sheets bytes.
- Excel import restores owned snapshot defect/detail custom metadata as well as result payloads.
- Initial combined run: 639 tests passed. New test fixtures subsequently corrected for full TypeScript and ESLint checks; final checks remain pending.
- Final identity/snapshot integration review found occurrence-based snapshot ownership still needed correction after reordered duplicate definitions; this is being fixed with a real Google read regression before completion.

- Final independent ownership review: both follow-up repros resolved; 50 focused tests passed, no new actionable findings. Full integrated tests: 647 passed/0 failed. Final full-project lint and production build (including TypeScript) passed; navigation/read-only/diff checks passed.

## Completion evidence

- `/tmp/qa-fix-complete-tests.log`: 647 passed / 0 failed.
- `/tmp/qa-fix-complete-lint.log`: empty, exit 0.
- `/tmp/qa-fix-complete-build.log`: production build complete, exit 0 (includes TypeScript).
- Navigation cache and read-only workspace scripts: passed.
- `git diff --check`: passed; parent ignore confirms `QAResultTestcase/` excluded without deletion.
- All eight original findings fixed; follow-up ownership and Test data parity regressions fixed and independently reviewed.
- No commit/push or live service mutations performed.
