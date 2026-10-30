# Approval delivery modes

Goal: Offer explicit “send from website” and “copy and send manually” modes. For company senders without a connected mailbox, disable website sending clearly. Manual mode prepares full copyable email, persists the draft, and lets an authorized QA confirm that they sent the request. Confirmation is user attestation, not provider delivery or PO approval.

Approach: Preserve direct OAuth delivery and old Outlook API behavior for already-open pages. Add manual mode for both supported sender domains. Persist each manual preparation and its confirmation in a separate service-only table. Prepare and confirm through transactional database functions so retries/concurrent preparations cannot confirm the wrong version. Existing PO decision, comments, token and links stay unchanged.

- [x] Add failing tests for mode availability, manual preparation/resume, confirmation access/idempotency/staleness, transactional persistence and PO-decision preservation.
- [x] Add migration, manual delivery types/helpers and server actions. No remote database changes unless separately authorized.
- [x] Add universal mode picker and copy/confirm dialog, resumable saved drafts, truthful actor/time labels. Remove Outlook-launch controls from the new flow.
- [x] Run focused/full tests with Node 22, SQL tests, typecheck and lint. Review and verify actual UI with fixture data; do not send real mail.

Review focus: missing Microsoft configuration must not block manual mode; switching sender/mode must not authorize direct sending; invalid/foreign/stale/revoked confirmations must fail; confirmation must not reset PO status or claim provider delivery; repeat confirmation must preserve the original actor/time; draft must survive reopening and full Thai text must remain copyable.

Verification complete: 764/764 full-suite tests passed on Node 22.23.2, including real SQL via PGlite, server-action execution fixtures, mode availability and manual draft UI tests. TypeScript, scoped ESLint and git diff --check passed. Independent reviewer flagged explicit manual mode being reset on sender edits; fixed with a composer selection reducer and RED→GREEN regression test. Remaining SQL/server review found no additional issues. Browser fixture using actual picker, reducer and dialog verified company website mode disabled, both Gmail modes selectable, explicit manual mode surviving sender changes, user-confirmed state, repeat-confirm disabled and reopening/keyboard close. Screenshot: /tmp/qa-delivery-modes-preview/modes-final.jpg.

The migration is authored and tested locally; it has not been applied to a remote database. No deployment, production draft/confirmation write or real email sending was performed. Actual end-to-end production use requires applying the migration before deployment.
