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
