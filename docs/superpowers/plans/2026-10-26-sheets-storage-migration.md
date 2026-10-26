# Sheets storage migration implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. User has authorized implementing the proposed flow and deleting only verified unused copies.

**Goal:** Stop permanent workbook duplication for Sheets-linked projects, retain structured results and Drive evidence, reclaim only proven unused historical source objects.
**Architecture:** Keep versioned source metadata and existing checkpoints. Store Sheets workbooks only in memory; explicit workbook requests export a revision-checked Sheets source. Local Excel uploads retain storage. Preserve all latest and history-referenced source files during cleanup.
**Tech Stack:** Next 16, TypeScript, Supabase, existing Google Sheets/Drive APIs and OOXML parser.
**Spec:** docs/qa-sheets-storage-proposal-2026-10-26.md

## Constraints and review focus

- Never delete the original Sheets document or evidence in Drive.
- Legacy workbooks remain readable. Historical Sprint sources cannot be substituted with live Sheets.
- Keep every register row separate and retain shared Ref ownership.
- Metadata-only versions must not falsely claim physical workbook storage or trigger Storage downloads.
- A changed source revision must stop recovery/export instead of silently mixing current bytes and saved row positions.
- Raw unmapped tabs may fetch Sheets; complete persisted case details must render without a workbook.

## Tasks

- [x] Add storage policy tests and implementation: Sheets metadata only, local uploads unchanged, legacy reads unchanged.
- [x] Add revision-checked workbook download tests and endpoint; apply on-demand hydration and resume handling.
- [x] Ensure completed case results display without workbook hydration; update export errors and retain source context.
- [x] Add conservative cleanup planner tests: preserve latest, referenced test-case source IDs, Sprint header sources, in-progress imports and local Excel sources. Verify exact object paths before deletion. Keep metadata rows for audit/history.
- [x] Inventory live data, execute only eligible old object cleanup, report returned deleted objects/bytes separately from billed usage.
- [x] Run relevant tests, full regression suite, build/lint, focused independent review, live read checks and document outcome.

## Rulings

- No schema change: source_files supports provider=local and a non-null empty storage_key. Mapping workbookStorage=google-sheets identifies metadata-only sources; byte_size=0 records no stored bytes.
- Keep latest legacy copies until their individual migration is verified; the new code handles both generations immediately. This frees older unreferenced versions without converting historical data blindly.
- No commits or deployment requested. Preserve the existing working tree.

- Ruling: add a tested service-only database cleanup lease so reference checks remain valid during deletion. User writes receive a retry message during this short maintenance period; reads continue.
- Ruling: prove Sheets origin per source record, never infer it from the project link alone. Unknown older originals remain held.
- Independent review found and verified fixes for import origin, source-ID hydration, reference races, and expired/missing-lease renewal.

## Verified outcome

- 606 tests pass; production build, focused lint, TypeScript and read-only regression checks pass.
- Pay ban cancel source v10 is metadata-only: byte_size=0, empty Storage key, complete=true, refreshRequired=false, all names present. UI:42 register cases,239/239 evidence,23/23tabs.
- Persisted case detail renders and7 visible images loaded from Drive. Cold Export downloaded source v10 via revision-checked Sheets endpoint (HTTP200), then returned its export control to ready state.
- User explicitly approved131 versions/2.10GB after automatic approval review required exact-list confirmation. Completed all131; journal reports2,102,419,929 bytes removed.
- Read-only SQL verification:912 test_cases,912 test_executions,131 retired metadata versions,0 active cleanup leases. Physical Storage has318 objects totaling2,264,349,790 bytes. Further deletion was not performed; quota remains above1GB.
