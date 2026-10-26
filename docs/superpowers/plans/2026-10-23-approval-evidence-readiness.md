# Approval Evidence Readiness Implementation Plan

**Goal:** PO must receive persisted evidence without QA opening every case first.

**Architecture:** Reuse the existing whole-workbook importer, which uploads evidence independently of case viewing. Record the exact case/sheet/anchor targets after that upload stage. Client and server require a complete import and matching persisted attachments before sending any approval email. Keep image display lazy. Do not send emails during verification.

**Tech Stack:** Next.js 16.3.4, React, Supabase JSON metadata, existing workbook importer.

## Tasks

- [x] Add tested evidence manifest/readiness helpers covering incomplete imports, legacy metadata, missing attachments, no-image workbooks, manual assignments, and unrelated QA uploads.
- [x] Persist expected manifests before the full evidence stage and completion only after it. Verify actual saved attachments, not image metadata counts. Resume unfinished imports; offer a full refresh for legacy imports without a manifest.
- [x] Add approval preparation control/status and disable approval while incomplete. Guard handlers and the server action before mailbox access/request creation/delivery.
- [x] Verify tests, read-only checks, type/build/lint and local UI. Inspect the final diff and document remaining live-upload verification limits.

No new queue service or deployment is introduced. Existing imports continue in the browser while navigating within the app; closing the app requires resuming the import. Whole-project import never depends on opening individual cases.

## Verification details

- Tests exercise unopened cases, partial upload failure, legacy checkpoints, missing/deleted latest attachments, pagination beyond 500 executions, reconnecting a different spreadsheet, and two different image contents at one cell.
- Evidence identity includes SHA-256 of the image content plus original sheet/anchor, represented by a fixed 76-character key to survive Drive filenames.
- Current Release UI correctly shows incomplete evidence, a whole-project import button and a disabled send button. Live bulk uploads and sending an email were not performed in this coding verification. Existing projects require the whole-project preparation step once; old metadata is not trusted as proof of uploads.
- Final verification: 442 tests passed, ESLint and production build/TypeScript passed, read-only and navigation cache checks passed. Screenshot: `/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/21-approval-evidence-blocked.png`.
