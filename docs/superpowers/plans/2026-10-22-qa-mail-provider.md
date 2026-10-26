# QA Mail Provider Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** QA sends real approval email from their own Gmail or Microsoft 365 mailbox, and PO replies return to that QA.

**Architecture:** Keep the existing Gmail adapter and introduce a Microsoft delegated OAuth adapter. Share sender selection, connection presentation, delivery metadata, and error handling without changing approval decisions.

**Tech Stack:** Next.js 16.3.4, TypeScript, Supabase, Gmail API, Microsoft Graph, MSAL Node.

**Spec:** ../specs/2026-10-22-qa-mail-provider-design.md

## Global Constraints

- From and Reply-To must match authenticated QA; no central-account fallback.
- gmail.com selects Gmail; truecorp.co.th selects Microsoft; recipient domain never selects sender.
- Preserve existing uncommitted changes and Drive/Sheets OAuth.
- Read bundled Next.js documentation before code changes; encrypt server-side credentials with per-user RLS.
- Graph 202 has no message ID/body; acceptance is not confirmed Inbox delivery.
- Deliver the manual-send slice first. Reminders, automated decision notifications, and new review rounds remain the next slice, as specified in the design.

## Review Focus

- A Microsoft UPN matching QA but a different primary mailbox must be rejected.
- A callback for another QA, missing state, or an external return path must be rejected.
- Graph 202 without body must succeed without inventing a provider message ID.
- A timeout after send must not trigger a retry or clear a PO decision.
- Missing Microsoft configuration must show an actionable error without exposing secrets or switching to Gmail.

### Task 1: Provider selection and delivery semantics

**Files:** `src/lib/mail-provider.ts`, `src/lib/mail-provider.test.ts`, `src/lib/approval-email.ts`, `src/lib/approval-email.test.ts`, `src/lib/approval-notification.ts`, `src/lib/approval-notification.test.ts`.

**Interfaces:** `mailProvider(email): "gmail" | "microsoft" | null`; provider-aware delivery takes an optional provider and preserves Gmail default compatibility. Microsoft acceptance uses an application operation ID as such, not a fabricated Graph message ID.

- [x] Write tests selecting by QA domain, preserving cross-domain recipients and QA Reply-To, recognizing Microsoft pending/update/accepted states, and sanitizing failure messages.
- [x] Run `npx tsx --test src/lib/mail-provider.test.ts src/lib/approval-email.test.ts src/lib/approval-notification.test.ts`; verify new assertions fail before implementation.
- [x] Implement pure selection, safe connect/return URLs, Microsoft Graph message conversion/error mapping and provider-aware metadata.
- [x] Rerun the same tests; expect all pass.

### Task 2: Microsoft connection and real sending

**Files:** `src/lib/microsoft-mail.ts`, `src/lib/microsoft-mail.test.ts`, `src/lib/microsoft-mail-server.ts`, `src/lib/qa-mail-server.ts`, `src/app/api/microsoft/auth/{start,callback}/route.ts`, Microsoft mail migration/test, `package.json`, `package-lock.json`.

**Interfaces:** encrypted Microsoft connection contains `mailEmail`, `accountId`, serialized MSAL cache. `getQaMailSender(email)` produces a send callback and provider; `getQaMailConnection(email)` returns connected/configured metadata without secrets.

- [x] Write tests for real HTTP request content/status handling, exact mailbox binding, missing permissions, state/user/expiry validation, safe redirects, and RLS isolation.
- [x] Run those tests, confirm expected failures, then install a pinned MSAL Node release and create the migration through the Supabase CLI.
- [x] Implement tenant-scoped MSAL with PKCE, protected state cookie and server cache persistence, `/me` mailbox verification and `/me/sendMail` with no automatic retry.
- [x] Run Microsoft tests including database migration twice and two-user access denial; expect pass.

### Task 3: Wire UI/actions and document setup

**Files:** `src/app/actions.ts`, `src/components/qa-workspace.tsx`, `.env.example`, `README.md`, `docs/qa-mail-setup.md`.

**Interfaces:** `getApprovalMailConnection(projectId)` returns provider, email, connected, configured, and optional error. Sending uses server QA identity, not browser From or provider.

- [x] Wire common connection/sender into actions, preserve request deduplication and existing approval state, keep a compatibility wrapper for old connection action.
- [x] Replace Gmail-only UI with account-aware connection labels and receipt status; preserve editable drafts across OAuth. Never send automatically after callback.
- [x] Document Entra permissions, callback URLs, required environment variables, migration, consent policy, and real send/reply validation.
- [x] Run relevant tests, typecheck, lint on changed files, full library suite and production build with a supported Node runtime; record unrelated failures.
- [x] Review the final diff against the spec and report actual readiness and missing external configuration. Do not send real email without a user-specified test recipient.

## Execution ledger

- 2026-10-22: User authorized implementation in this chat. Continue inline; no repeated implementation approval request.
- Ruling: Work in the supplied checkout to preserve existing Gmail changes; do not relocate or commit the user's mixed working tree.
- Ruling: Reminder policy and mailbox-to-self notification UX are explicitly a later slice in the approved spec; do not enable schedules during manual-send implementation.

- Ruling: Webpack build exposed a pre-existing browser import of `node:crypto` through sync/canonical.ts. Move only snapshot hashing to sync/snapshot-hash.ts and update the server consumer/tests; keep canonicalization and hash output unchanged. The failing production build is the regression reproducer.

## Verification record

- Task 1: provider/receipt tests observed failing before implementation, then passed.
- Task 2: encrypted storage and RLS tests observed failing before implementation, then passed; migration tested twice with two QA identities and anonymous denial.
- Task 3: UI/actions integrated; OAuth does not send automatically. Checked configuration presence without exposing values: Microsoft tenant/client/secret/encryption configuration absent from .env.local.
- Final full library suite: 388 passed, 0 failures (`node --import tsx --test --test-concurrency=2 src/lib/*.test.ts src/lib/sync/*.test.ts`).
- TypeScript and changed-file ESLint passed. Production webpack build passed including Microsoft routes; default Turbopack build checked separately below.
- Independent reviewer found no actionable defects in the mail implementation or the small browser/server hashing separation.
- No production migration, deployment, or real email send performed. Live tenant consent, refresh, Sent Items and PO Reply verification require configured Microsoft application and an explicitly specified test recipient.
- No commits made: preserve the user's pre-existing mixed working tree.

- Default production build (`next build`, Turbopack) passed outside sandbox; sandbox attempts were interrupted when no progress appeared. No bundler setting or build script changed.
- Production HTTP smoke passed against a temporary local `next start`: login 200, Microsoft start without login 401, invalid callback safely redirects with an error and expires the OAuth state cookie. Temporary server stopped afterward.
- Restored next-env.d.ts to its pre-build dev type references; no user source changes reverted.
