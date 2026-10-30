# Outlook Approval Draft Implementation Plan

**Goal:** Let QA prepare a PO approval email from @truecorp.co.th and send it through their own Outlook without granting the website Microsoft mail access.

**Architecture:** Reuse the existing approval creation action and evidence/access checks. Add explicit `deliveryMode: "outlook" | "oauth"` (default remains oauth for old callers). Outlook mode creates/reuses a review request and returns a draft without acquiring credentials or sending anything. Show the draft in a dialog with a mailto link and copy controls. Company senders default to Outlook mode; Gmail retains current sending.

**Constraints:** Preserve existing PO decisions and review links. Keep sent timestamp null and display manual-send status. Do not claim which From Outlook will choose. Require the user to select the requested From and press Send. Avoid silent content loss for long mailto URLs. No migration or added dependency. Preserve pre-existing workspace edits.

- [x] Add failing tests for manual preparation without OAuth/send, evidence and permission gates, update preservation, direct-send compatibility, and encoded/bounded mailto links.
- [x] Add Outlook draft types and link builder; extend action and delivery labels.
- [x] Add draft dialog, company delivery selector/default, manual confirmation and clipboard fallbacks; preserve direct OAuth drafts.
- [x] Run focused tests, full suite on Node 22, typecheck, lint and diff checks. Review implementation and document manual verification limits.

**Review focus:** Microsoft is unconfigured; wrong sender/recipient; long Thai text; browser mail handler absent; existing approved request; changing delivery/sender; manual draft must never trigger provider APIs or mark sent.

**Verification:** New tests first reproduced missing manual preparation, unrecognized draft mode and absent manual-send label. Focused checks passed. Full suite on Node 22.23.2 passed 741/741. TypeScript and scoped ESLint passed; git diff --check passed. Independent code reviewer found no actionable issues. Bundled the actual new dialog with the project stylesheet and tested rendering, compose-link contents, scrolling and Escape close in the in-app browser with sample data. Screenshot: /tmp/qa-outlook-preview/outlook-draft.jpg. No provider access, real consent or real email sending was performed; actual Outlook handler, From selection, Send and delivery remain user verification steps.
