# Creator Drive evidence implementation plan

**Approved behavior:** New project images belong in the project creator's Google Drive even when another editor imports them. A missing or expired creator connection stops uploads and identifies who must reconnect. Existing files are not moved. Existing video uploads to R2 remain supported.

**Design:** Use `projects.owner_id` from the authorized server lookup, then read only that user's encrypted Google connection with the server admin client. Never accept an owner/account from the request or fall back to the editor's credentials. Folder caches use the Drive owner's identity; uploader metadata continues to identify the editor. New images use Drive even if R2 is configured. Credentials stay server-side. Keep existing file sharing behavior.

**Approaches:** The user selected creator-owned Drive over editor-owned uploads or a shared storage destination. No schema, scope, permission, or existing-file ownership changes are needed.

- [x] Test the actual evidence POST handler with external Google/database boundaries replaced: A/B account routing, image routing with R2 configured, missing/expired owner connection, absent owner, and denied editor.
- [x] Load the creator connection only after project edit authorization, update Drive folder scope, and return a creator-specific error with a reconnect URL only when the current user is the creator.
- [x] Preserve that error in bulk Sheets imports so another editor is not redirected into connecting their own account.
- [x] Run focused/full tests, types, lint, build, and independent review. Verify through controlled route tests without adding or moving real project evidence.

**Verification:** Nine route tests pass; the full suite passes 503/503. Production build including TypeScript, changed-file lint, read-only/navigation guards, and diff whitespace checks pass. Independent review found the signed R2 upload endpoint also accepted images; both issuance and completion now reject images, with regression coverage confirming video uploads still complete. Follow-up review approved the change. Controlled tests exercise the actual handlers with external services replaced; no real files were uploaded or moved for this verification.
