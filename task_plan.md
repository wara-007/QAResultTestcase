# Editable PO approval sender

Objective: Allow QA to edit the sender email before requesting PO approval and send only through that user's verified OAuth mailbox.

- [x] Inspect approval form, server action, draft persistence, Gmail and Microsoft OAuth flows.
- [x] Add sender selection validation, draft persistence and regression tests.
- [x] Pass sender through connection status, OAuth state and approval delivery; keep grants bound to signed-in user.
- [x] Verify targeted tests, typecheck and lint; review diff for unrelated changes.

Decisions: Default to signed-in email; support existing Gmail and truecorp Microsoft domains. Changing sender requires a matching verified mailbox grant. Preserve draft through OAuth. No database schema change.

Verification:
- Initial new tests reproduced missing sender propagation and malformed draft acceptance; fixed.
- Replaced source-text evidence-order assertion with execution tests covering access, evidence and selected grant ordering.
- Targeted approval/mail tests: 36 passed.
- Full suite on required Node 22.23.2: 726 passed; additional OAuth route tests: 3 passed.
- Initial default Node 20 run failed in project-data (3 tests) and source-mapping-checkpoint (2 tests) due to unavailable native WebSocket. Required Node 22 resolved all five failures.
- Final TypeScript and scoped ESLint checks passed; git diff --check passed.
- Actual OAuth consent and real email delivery have not been exercised; no email was sent.

Complete. Ready for user review and manual OAuth/email verification.

# Outlook manual sending (2026-10-29)

User approved trying an Outlook draft workflow because IT may not approve Microsoft OAuth. Implementation plan: docs/superpowers/plans/2026-10-29-outlook-approval-draft.md.

- [x] Tests and server preparation without sending.
- [x] Outlook draft dialog and company sender default.
- [x] Verification and review. Node 22 full suite: 741/741; TypeScript, scoped ESLint and diff checks passed; independent review clean; actual dialog rendered and Escape-close verified in browser with sample data. Real Outlook launch and email sending remain manual checks.

# Selectable delivery modes (2026-10-30)

User approved explicit website-send vs copy-and-confirm modes. Plan: docs/superpowers/plans/2026-10-30-approval-delivery-modes.md.

- [x] Transactional persistence and regression tests.
- [x] Mode picker and resumable copy/confirm UI.
- [x] Verification and review: 764/764 tests, TypeScript, scoped ESLint and diff checks passed. SQL tested locally. Reviewer finding for preserving explicit manual selection fixed with regression coverage; remaining review clean. Actual components verified in browser fixture. New migration must be applied before deployment; no remote DB writes or emails sent.

# Approval tabs and Gmail notice (2026-10-30)

- [x] Replace delivery select with accessible tabs and keyboard navigation.
- [x] Add an inline Gmail junk-folder notice with possible causes and recipient guidance.
- [x] Simplify manual copy UI to project name/body. Preserved existing PO-link access behavior; moved recipient/sender into collapsed link settings rather than removing required authorization. User confirmed retaining the Approve link and PO email setting.
- [x] Run focused/full tests, typecheck, lint and browser verification: full suite 767/767 passed on Node 22; browser fixture verified arrow-key tab switching, Gmail warning visibility, collapsed PO settings, and project/body-only copy dialog. Final TypeScript/lint recheck and git diff --check passed. Independent UI review found no additional issues. Screenshots: /tmp/qa-approval-tabs-preview/manual-tab.jpg and gmail-warning.jpg. No real mail sent or deployment performed.

Manual link/access behavior remains unchanged. No additional migration is needed for the optional projectName field in stored drafts. Gmail warning describes possible causes, not a diagnosis of a particular email; source: Microsoft Defender anti-spam FAQ.


# Visible copy actions (2026-10-30)

User could not find copy buttons because they were behind the preparation dialog. Add visible project-name copy beside its field and body/link copy below its textarea. Body action first prepares the authorized review link, attempts clipboard write, and opens the persisted draft; if async clipboard write is blocked, the existing dialog provides direct-click copy fallback. Keep evidence/PO checks and manual-send confirmation unchanged. Verified: 769/769 full tests, TypeScript, scoped ESLint and diff checks passed. Actual composer rendered with both copy buttons visible on the tab; screenshot /tmp/qa-approval-tabs-preview/visible-copy-buttons.jpg. Clipboard fallback retains the prepared draft. No real email or deployment performed.


# Always-visible PO settings (2026-10-30)

User requested essential link settings above the copy action, always expanded. Replaced details/summary with a named section above the primary copy button, removed obsolete open/close state/props, and updated tests/docs. Tests verified fields are rendered without collapse controls and before body-copy action. Full suite 769/769, TypeScript, scoped ESLint and diff checks passed. Browser preview confirmed visual order; screenshot /tmp/qa-approval-tabs-preview/po-settings-above-copy.jpg. No deployment or real email sending.


# Remove sender input from manual copying (2026-10-30)

Removed the manual sender field and its composer props. Manual client no longer validates or submits a chosen sender; server ignores a user-supplied manual sender and leaves that metadata blank. Authenticated QA identity still authorizes the request and records confirmation. Direct-send sender validation/grants are unchanged. Regression tests cover absent/blank/invalid selected sender with successful manual preparation and no provider access. Full suite 770/770, TypeScript, scoped ESLint and diff checks passed. No additional migration, deployment or real email sending.
# Reduce duplicate Sheets workbook downloads (2026-11-02)

Objective: Reduce Netlify compute/bandwidth from repeated workbook exports without weakening freshness or project access checks.

Evidence: `readGoogleSheetRevision` exports the whole workbook on Drive metadata 404; the browser later requests the same revision's workbook again. The reported failing request uses an `xlsx-v2:` revision, confirming this fallback is used. Billing is team-wide; no endpoint-level production measurements are available yet.

- [x] Inspect revision, download, browser cache and automatic import paths.
- [x] Add failing tests for reuse of fallback bytes, ordinary metadata-only checks, malformed responses and revision validation.
- [x] Return fallback bytes only on an explicit revision request option; retain existing JSON behavior for other callers. Reuse the bytes in the existing browser revision-keyed cache.
- [x] Verify regression tests, full available suite, typecheck, scoped lint and diff.

Constraints: Authenticate and authorize each server request as before. No shared server cache of private files. No change to automatic import/freshness policy. Keep the earlier Unicode filename fix. No deployment in this task.

Verification: Confirmed new snapshot/reuse tests fail before implementation, then pass. Node 22.23.2 full discovered source suite: 789/789 passed. Final TypeScript and scoped ESLint passed. Metadata-only checks, unchanged completed revision checks, authorization denial, malformed/HTML errors, revision-bound byte reuse and cancellation are covered. Concurrent revision-timeout work was preserved and tested together. Stable callback dependencies avoid re-triggering workspace loading on source changes.

Outcome: Fallback revision bytes can satisfy the subsequent workbook request with no second export. Completed unchanged imports receive JSON only; final consistency checks do not transfer workbook bytes. This reduces duplicate export work, but cannot quantify team-wide credit savings without production endpoint timings and usage measurements.

Next action: Deploy via the normal release process, verify the affected Project, and compare export requests/latency and Compute usage for equivalent activity. No deployment or remote data mutation performed.

# Sheets revision inactivity timeout (2026-11-02)

Objective: Bound revision checks before the hosting timeout and handle HTML gateway errors without JSON syntax errors. Preserve existing workbook filename changes and the separate pending download-reuse work above.

Evidence: Reported `google-sheet?revision=1` returns HTML HTTP 504. Revision fallback exports XLSX with a 120s fetch timeout; Drive revision lookup alone allows 30s, and fallback repeats metadata lookup. Existing incident notes record a 30s Netlify invocation cutoff. Exact production upstream latency is not available locally.

- [x] Trace revision route, Google fallback, and browser parser; read installed Next route-handler guide.
- [x] Reproduce HTML-response handling and revision cancellation with regression tests.
- [x] Add a 20s total revision deadline (including access/auth), propagate cancellation to Google requests, and preserve auth/error behavior in the browser.
- [x] Verify focused/full tests, TypeScript, scoped ESLint and diff.

Success: slow checks return a controlled JSON timeout, Google requests receive cancellation, HTML 504 yields actionable Thai text, and successful/auth-denied responses retain current behavior. Production load performance remains to be measured after deployment; this does not make a slow Google export faster.

Verification: New cancellation tests failed before propagation; route tests reproduced unbounded hangs before the deadline change. Focused tests passed 27/27; full Node 22.23.2 suite passed 789/789. Final TypeScript, scoped ESLint and `git diff --check` passed. Corrected optional auth and untyped fetch mock parameters found by TypeScript. Concurrent workspace changes provide workbook reuse and HTML response handling; preserved those changes. No deployment or remote data writes. Next action: deploy through the normal release process and measure the affected project's revision/export latency; slow exports may still return the controlled timeout.
# Sheets revision timeout on Netlify (2026-11-10)

Objective: Keep the Sheets revision check responsive for large workbooks while preserving the existing revision and import checkpoint semantics.

- [x] Reproduce the gateway timeout and measure the affected workbook. Chrome reported HTTP 500 after 36.09s. A direct metadata response also hit the inactivity timeout. Production is on `f2858ec`. The downloaded workbook has about 49.5 MB of XLSX data and 30.7 MB of uncompressed XML. Local synchronous hashing took 6.7s. Netlify server invocations around the retries ran 51–54s, with peak memory up to 929 MB. The logs do not break time down by stage.
- [x] Add regression coverage for cancelling revision calculation and avoiding a repeated Drive lookup after 404. Both tests failed before the fix and passed afterward.
- [x] Let the existing deadline interrupt workbook hashing between files. Hash each normalized entry in order as it is processed and preserve the `xlsx-v2` digest.
- [x] Compare the real workbook hash and local time against the baseline. Same `xlsx-v2` digest in 5.2s locally. An artificial 1s deadline on the same workbook returned a controlled timeout in 1.07s.
- [x] Verify focused tests (37/37), full suite (790/790), TypeScript, ESLint, and production build on Node 22.23.2. Restore Next's generated local type import after the build.

Next action: Verify the affected production project after deploying the patch. The measured hashing improvement is local. A slow Google export can still reach the route's deadline.

# Resume missing evidence on a long Sheets tab title (2026-11-10)

- [x] Reproduce 72/73 on localhost. The full title shown in the tab queue is 39 characters. The workbook contains the remaining PNG at B30 under its 31-character export title, so the queue never reaches that image.
- [x] Add a failing workbook regression and restore the Google title before deriving result IDs and evidence targets. Preserve exact matches and leave ambiguous prefixes unassigned.
- [x] Verify the actual workbook still yields 73 evidence targets. The image at B30 now reaches the full-title import queue, and a simulated upload and checkpoint satisfy readiness. Focused tests 51/51, full suite 790/790, TypeScript, and scoped ESLint passed.

The user resumed import and confirmed 73/73 evidence references and 37/37 tabs saved on localhost. The final Sheets revision check timed out after those checkpoints.

# Show saved import separately from the Sheets revision check (2026-11-10)

- [x] Trace the 100% import and paused banner to the final revision check. Record revision failures as such, including during manual resume.
- [x] Show that data and evidence are saved while awaiting revision confirmation. Offer another revision check and retain the existing matching-revision requirement for finalizing the snapshot.
- [x] Reproduce the misleading wording in a rendering test. All 37 focused evidence and progress tests passed.
- [x] TypeScript, scoped ESLint, and diff checks passed. On the live localhost project, the automatic revision check finished and the completed page returned to the normal Sheets refresh action with 30 cases and no paused status.

# Reconcile corrected Sheets TCIDs

- [x] Verify the project in the screenshot. Both saved records use register row 17 and the same definition. The completed import baseline contains BAN_04_TC_01 and the separate row 2 case. The old row 17 record has one Not Start attempt and no results or defects.
- [x] Reuse the same case record for an unambiguous TCID edit and filter existing empty placeholders from the active workspace using the completed register baseline. Preserve stored rows and QA evidence.
- [x] Both new regression cases failed before the patch and passed after it. A read-only check through the real workspace loader returned four register cases, including BAN_01_TC_01 at row 2 and BAN_04_TC_01 at row 17 with its Pass result. All 793 tests, TypeScript, scoped ESLint, and diff checks passed.

# Stream long Sheets revision checks (2026-11-10)

- [x] Production still reached the 20s application deadline on an XLSX revision check. The previous patch converted the gateway failure into an application timeout. The affected workbook export is 49.5 MB.
- [x] Return response headers and an initial heartbeat before waiting for Google. Give the opted-in stream up to 55s within the documented 60s function budget. Keep the existing short JSON path for older clients.
- [x] Test early response, unchanged and changed snapshots, truncated responses, authorization, and timeout cancellation. All 33 focused tests passed.
- [x] The actual TOL Reboot Router project completed its automatic revision check on localhost and returned to the normal update action with 30 cases. All 798 tests, ESLint and the production build passed.
- [ ] Verify the affected request on Netlify after deployment, including the transfer of a large changed workbook.
