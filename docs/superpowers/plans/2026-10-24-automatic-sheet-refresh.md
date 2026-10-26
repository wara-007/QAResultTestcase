# Automatic Sheets Refresh Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in this existing workspace. User has authorized implementation; preserve unrelated edits and do not commit.

**Goal:** On browser refresh, check Sheets revision and import genuinely new data with visible progress only when needed.

**Architecture:** Read Drive file version through the authorized project API. Save the imported revision and a lightweight register baseline with the source checkpoint. Merge remote-only changes while preserving QA results and resolving simultaneous metadata edits explicitly.

**Tech Stack:** Next.js 16, React, Google Drive API, existing Supabase source checkpoints.

**Spec:** User request in this chat: “มีการเปลี่ยนแปลง → ดึงข้อมูลใหม่และแสดง progress bar ควรได้ข้อมูลใหม่”.

## Global Constraints
- Retain saved cases/evidence on failure; never mark a changing source complete.
- Read-only access cannot import. Do not send PO mail.
- Show one import action, plain Thai status, and progress while checking/importing.

## Review Focus
- A changed revision cannot reuse an old workbook.
- An unchanged revision cannot start duplicate imports.
- A source edited during import cannot be marked current.
- Imported metadata must refresh while QA results/evidence survive.
- Failed revision checks retain saved data and give a retry path.

### Task 1: Revision and merge decisions
- [x] Add failing tests for missing/same/changed revisions, checkpoint preservation, fresh metadata, local-only edits and simultaneous conflicts.
- [x] Implement pure refresh helpers and persist revision/baseline in SheetImportState.
- [x] Run focused tests.

### Task 2: API and workspace lifecycle
- [x] Add authenticated no-store revision GET and validate checkpoint metadata.
- [x] Check once per project lifecycle after workspace load, fresh import on changed/missing revision; same revision reuses saved data.
- [x] Capture revision before import and recheck before marking complete.
- [x] Render checking progress and gate PO readiness during checks.

### Task 3: Verification
- [x] Run full tests, lint, TypeScript, production build, navigation and read-only guards.
- [x] Finish live import and unchanged-source reload verification.

## Verification evidence
- 481 source tests pass, including timeout/fallback and stale-success guards; production build and TypeScript pass.
- ESLint, navigation cache and read-only guards pass (guard now includes the checking phase).
- Independent review: initial save/check race, legacy conflicts and newly introduced conflicts corrected; no remaining important findings.
- Live OAuth uses drive.file and Drive returns 404 for the linked native Sheet. The fallback compares authorized XLSX contents, including image bytes and placement, without expanding scopes.
- Two real 37.4 MB exports had different media numbering and generated picture names. Canonical revisions match after resolving media references by content hash. Unit tests still detect changed cells/images.
- Browser refresh visibly starts source checking and then the existing import progress panel without pressing an import button. Full live import completed successfully; see final evidence below.

### Live integration follow-up
- Legacy MRS register rows omit step text. Missing steps/expected without any baseline retain the saved instructions; known-baseline clearing still applies.
- A real save of TC_18 encountered a PostgreSQL statement timeout. The atomic RPC now retries only confirmed cancellation code 57014, at most three attempts, inside the same project queue. Permanent/auth/network errors are not retried.
- Workbook fallback text now preserves QA-edited results as well as the main metadata merge.
- Failed refresh status overrides an older completed snapshot; PO sending remains blocked while refresh reports an error.

## Final live result
- Release project: 46 cases, 40/40 source tabs, 54/54 persisted image evidence; progress reached 100%.
- Source version 10: sourceRevision present, complete=true, refreshRequired=false. Additional testcase lookup checkpoints account for 49 stored state keys; the workbook itself has 40 tabs.
- Hard reload showed source-check progress, then returned to completed state without another import. Source version remained 10.
- Fixed sparse imported rows writing source_row=0 during bulk persistence; absent source rows now use SQL NULL, consistent with the existing atomic save RPC.
- Final validation: 481/481 tests, production build/TypeScript, ESLint, read-only and navigation cache guards, git diff --check all pass.

## Follow-up: false change detection and auxiliary-sheet evidence
- Compared Web Handle Error 404 source exports: resolved cell text, cell formatting and image bytes were identical. Google permuted sharedStrings, fonts/fills/borders, custom number-format IDs and cellXfs references; the old byte-oriented signature incorrectly marked each export changed.
- Added workbook-revision-xml.ts to resolve dictionary references before hashing, retaining implicit index-zero defaults, rich text, actual cell/style changes and media relationships. Revision prefix xlsx-v2 separates the corrected format from legacy signatures.
- Actual saved exports v10 and v11 produce identical corrected revisions. Permuted-dictionary and implicit-default regression tests cover the reported false positive and prevent false negatives.
- Evidence readiness now uses all persisted workspace snapshots, matching the approval server. The Deeplink image counts toward the evidence manifest while the register remains 18 test cases.
- Focused independent review passed after preserving implicit defaults. Full suite: 485 tests pass; build, TypeScript, lint and permission/navigation guards pass.
- Final live verification: Web Handle Error 404 shows 18 register cases, 14/14 tabs, 26/26 image evidence and no error banner. Hard reload returns to completed state; persisted source version remains 13 with complete=true, refreshRequired=false, and the same attemptedAt timestamp (2026-10-24T11:19:44.810Z).

## Follow-up: interrupted source workbook upload
- Release screenshot reported source workbook part 5/5 failed with “Failed to fetch”. The prior sequential upload stopped after the first error in a part, even when earlier parts succeeded.
- Added bounded per-part retries (three attempts), preserving the same part bytes/path. Network/408/429/5xx failures retry; permanent permission/validation errors fail immediately.
- A retried INSERT may report a duplicate after the original response was lost. Download and compare the full part bytes before accepting that result; never enable upsert or expand storage permissions.
- Preserve the latest saved workbook and its newly invalidated import checkpoint in local/cache state until the replacement is fully uploaded and registered. Resume uses the freshly loaded source ID.
- A live retry also exposed the Google export’s 60-second cap for this large workbook. Export now permits 120 seconds; the client workbook request permits 180 seconds.
- Avoid fetching Cover again for each filtered result-tab request. Summary/unfiltered/Cover requests still include its snapshot.
- The live import exposed a separate statement timeout when saving all 46 large executions in one request. Save case and execution rows sequentially in batches of five. Preserve the prior register baseline until the final checkpoint, and persist the image manifest with the source file so failed writes remain resumable.
- Reuse the uploaded workbook buffer after metadata reload instead of downloading all five parts again.
- Five transfer regression tests, two row-batch tests, two read-plan tests, and all 494 source tests pass. Production build/TypeScript, lint and permission/navigation guards pass. The final baseline adjustment passed TypeScript and 18 focused resume/upload/batching tests. Independent review identified and corrected premature baseline advancement.
- Live Release import completed: source version 13, all five workbook parts saved, 46 cases, 40/40 tabs, 54/54 images. Database checkpoint confirms complete=true and refreshRequired=false. A browser reload preserved the complete state with no error banner. Proof: `release-import-complete.png` in the task visualization directory.
