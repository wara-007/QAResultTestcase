# Whole-project import timeout

The reported project shows `canceling statement due to statement timeout` after reading Google Sheets details and before importing evidence. Reproduced in the browser on 2026-10-24. The persisted source had 40 tabs, three loaded tabs, and an incomplete import marked for refresh. The stored 34 executions contained roughly 8.6 MB of result data.

`private.save_test_case_result` obtains `FOR UPDATE` on the project row. Several import stages previously started every case RPC together through `completeProjectDetailWrites`. These requests competed for the same row lock and consumed their statement timeout while waiting.

The client now queues result writes by project **before creating the RPC request**. Other projects and parallel evidence transfers remain independent. Failed writes reject their caller, but do not poison later queued writes. Existing authorization and transaction functions are unchanged. Save errors identify the testcase.

The evidence progress panel now distinguishes a failed import from an import that has never started, instead of showing “waiting to start” after an error.

The next live run passed the old timeout and uploaded/persisted all 54 images. It exposed a second failure: the checkpoint's full-JSON equality condition produced a roughly 30 KB query URL. A synthetic, non-sensitive URL of that size returned `400 Bad Request`. Checkpoints now compare the PostgreSQL `xmin` row version instead, keeping the mapping in the request body. This protects against concurrent changes to any field without schema or permission changes. A real read with the compact condition succeeded; its filter was 66 bytes.

Verification: regression tests first reproduced concurrent same-project RPCs, the misleading waiting state, and the oversized checkpoint URL, then passed after the changes. Full suite: 460 tests passed. Next production build, ESLint, navigation-cache checks, read-only checks, and `git diff --check` passed.

Final live browser import completed successfully: 46 cases, 40/40 saved tabs, and 54/54 images. A separate read from Supabase confirmed `complete=true`, `refreshRequired=false`, and all 54 expected evidence targets persisted. The readiness verifier returned `ready=true`. No approval email was sent. Screenshots of real progress and completion are stored in the thread visualization directory as `import-progress-working.png` and `import-recovered-complete.png`.
