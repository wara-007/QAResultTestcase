# Global Project Read Access, Project Search, and Manual Sheet Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every authorized app user read every Group and Project, add instant Project search, and let Project editors persistently map unrecognized Google tabs to Test Cases.

**Architecture:** Supabase RLS exposes Project-owned rows through a global view predicate while retaining existing edit/manage/delete predicates. Project capability flags are computed server-side. Google tab mappings live in a dedicated RLS table keyed by stable Google `sheetId`, are applied through pure mapping-resolution helpers, and are edited through authenticated Project-scoped endpoints.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5.9, Supabase/Postgres RLS, Google Sheets API, Node test runner through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-29-global-project-read-and-sheet-mapping-design.md`

## Global Constraints

- Every enabled application user, including QA and PO accounts, can read every Group, Project, and Project-owned QA record.
- Global visibility must never grant mutation permission; RLS and server checks remain authoritative.
- Project deletion remains limited to the Project creator and System Owner.
- Durable Google mappings use numeric `sheetId`, never a mutable tab name, as source identity.
- Mapping never renames a Google tab, merges Test Cases, or deletes QA data.
- No new runtime dependency is introduced.
- Preserve unrelated uncommitted workspace changes and use Node.js 22 or later for verification.

## Review Focus

- An allowlisted PO who is not a Group member can read Project content but all direct mutation calls return 403.
- A Google tab rename with the same numeric `sheetId` retains its saved Test Case mapping and refreshes the displayed name.
- A mapping whose target Test Case was removed is shown invalid and is not silently reassigned by automatic inference.
- Two tabs mapped to the same Test Case remain two distinct source rows and neither appears in the unmapped section.
- Mapping/API failure leaves the Test Case list usable and visibly reports that saved mappings could not be applied.

---

### Task 1: Global Read Predicate and Project Capability Contract

**Files:**
- Create via `npx supabase migration new global_project_read_and_sheet_mappings`: `supabase/migrations/*_global_project_read_and_sheet_mappings.sql`
- Create: `src/lib/project-capabilities.ts`
- Create: `src/lib/project-capabilities.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/groups-server.ts`
- Modify: `src/lib/projects-server.ts`
- Modify: `src/components/groups-home.tsx`

**Interfaces:**
- Produces `ProjectAccessCapabilities = { canView: boolean; canEdit: boolean; canManage: boolean; canDelete: boolean }`.
- Produces `projectCapabilitiesFromRow(row): ProjectAccessCapabilities` for mapping server query/RPC output.
- Extends `Project` with all four capability flags.
- Produces database functions `private.can_view_project(uuid)` and `public.list_project_access(text)`.
- Keeps `private.can_access_project(uuid)` as the compatibility alias used by existing SELECT policies.

- [ ] **Step 1: Write failing capability tests**

Add tests asserting that a read-only row maps to view-only capabilities, an editor cannot implicitly manage/delete, and System Owner/creator values are preserved exactly.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/lib/project-capabilities.test.ts`

Expected: FAIL because the capability module and fields do not exist.

- [ ] **Step 3: Generate and implement the RLS migration**

Run `npx supabase migration new global_project_read_and_sheet_mappings`, then implement `private.can_view_project`, the compatibility `private.can_access_project`, global SELECT policies for every Project-owned table, and `public.list_project_access(requested_group_id text)`. Keep every INSERT/UPDATE/DELETE policy bound to the existing edit/manage/delete predicates. Revoke function access from `PUBLIC`/`anon` before granting authenticated execution.

- [ ] **Step 4: Implement the server capability contract and Group browsing UI**

Add `projectCapabilitiesFromRow`, extend `Project`, fetch `list_project_access` in `loadProjects`, and make every authorized Group card navigable while retaining `canManage` controls. Do not infer permissions from client-visible role text.

- [ ] **Step 5: Verify Task 1**

Run: `npx tsx --test src/lib/project-capabilities.test.ts && npm run typecheck && npm run lint`

Expected: PASS with no TypeScript or ESLint errors.

- [ ] **Step 6: Commit Task 1 files only**

Commit message: `feat: allow global project reads with scoped writes`

### Task 2: Instant Project Search

**Files:**
- Create: `src/lib/project-search.ts`
- Create: `src/lib/project-search.test.ts`
- Modify: `src/components/qa-workspace.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes the extended `Project` type from Task 1.
- Produces `filterProjects(projects: Project[], query: string): Project[]`.
- `ProjectsHome` owns its search query and renders search, result count, and clear action.

- [ ] **Step 1: Write failing search tests**

Test empty-query ordering, case/whitespace-insensitive matching, and matches against name, description, environment, sprint number, Google Sheets URL, and Google Sheet ID.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/lib/project-search.test.ts`

Expected: FAIL because `filterProjects` does not exist.

- [ ] **Step 3: Implement the pure filter and Projects UI**

Implement normalized client-side filtering without a network call. Add the search field above the grid, result count while filtering, a no-results state that echoes the query, and a clear-search action. Keep the existing Project order.

- [ ] **Step 4: Verify Task 2**

Run: `npx tsx --test src/lib/project-search.test.ts && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit Task 2 files only**

Commit message: `feat: add project catalogue search`

### Task 3: Stable Google Tab Metadata and Mapping Persistence

**Files:**
- Modify: generated `supabase/migrations/*_global_project_read_and_sheet_mappings.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/google-sheets.ts`
- Create: `src/lib/sheet-mappings.ts`
- Create: `src/lib/sheet-mappings.test.ts`
- Create: `src/app/api/projects/[projectId]/sheet-mappings/route.ts`
- Create: `src/app/api/projects/[projectId]/sheet-mappings/[sheetId]/route.ts`

**Interfaces:**
- Extends `WorkbookSheet` with `sheetId?: number`.
- Produces `ProjectSheetMapping` with `projectId`, `spreadsheetId`, `sheetId`, `sheetName`, `testcaseKey`, `mappedBy`, and timestamps.
- Produces `loadSheetMappings(projectId)`, `saveSheetMapping(projectId, input)`, and `deleteSheetMapping(projectId, sheetId)` server functions.
- GET returns `{ mappings: ProjectSheetMapping[] }`; PUT returns `{ mapping }`; DELETE returns `{ success: true }`.

- [ ] **Step 1: Write failing metadata and mapping tests**

Test preservation of numeric Google `sheetId`, mapping row conversion, rejection of non-integer/missing sheet IDs, and update behavior that changes `sheet_name` without changing mapping identity.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx tsx --test src/lib/sheet-mappings.test.ts`

Expected: FAIL because mapping types/helpers are missing and Google metadata does not expose `sheetId`.

- [ ] **Step 3: Add the mapping table and RLS to the generated migration**

Create `public.project_sheet_mappings` with a unique `(project_id, spreadsheet_id, sheet_id)` constraint, cascade on Project deletion, `updated_at` trigger, authenticated SELECT through `private.can_view_project`, editor-only INSERT/UPDATE/DELETE through `private.can_edit_project`, and `mapped_by = auth.uid()` checks. Revoke anonymous access.

- [ ] **Step 4: Expose stable Google metadata and implement the mapping service/API**

Populate `WorkbookSheet.sheetId` directly from Google metadata. Validate authentication, Project edit permission, numeric `sheetId`, Project spreadsheet identity, and existence of `testcaseKey` in current relational or Google summary data before upserting. GET requires view permission; PUT/DELETE require edit permission and return 403 for read-only users.

- [ ] **Step 5: Verify Task 3**

Run: `npx tsx --test src/lib/sheet-mappings.test.ts && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit Task 3 files only**

Commit message: `feat: persist manual Google sheet mappings`

### Task 4: Mapping Resolution and QA Mapping Interface

**Files:**
- Create: `src/lib/sheet-mapping-resolution.ts`
- Create: `src/lib/sheet-mapping-resolution.test.ts`
- Create: `src/components/sheet-mapping-control.tsx`
- Modify: `src/components/qa-workspace.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes `WorkbookSheet`, `ProjectSheetMapping`, and `TestCase`.
- Produces `resolveSheetAssociations(sheets, cases, mappings)` returning `{ associations, unmapped, invalidMappings }`.
- Persisted `sheetId` mapping takes priority over automatic Test Case inference.
- `SheetMappingControl` receives Project ID, sheet, cases, existing mapping, `canEdit`, and an `onChanged` callback.

- [ ] **Step 1: Write failing resolution tests**

Test mapping priority over inference, renamed tab retention by `sheetId`, two distinct mapped tabs for one Test Case, unmapping behavior, missing target behavior, and unmapped fallback when only a mutable tab name exists.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test src/lib/sheet-mapping-resolution.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the pure resolver**

Return associations without mutating source arrays. Mark missing targets invalid instead of invoking automatic inference. Deduplicate by stable sheet identity so a mapped tab appears exactly once.

- [ ] **Step 4: Implement the mapping UI and integrate it with Test cases**

Load mappings alongside the workspace. In the unmapped section, render a searchable Test Case selector and save action for editors; show read-only information to viewers. Apply saved mappings to aliases, detail routes, Result/Defect filtering, and imported image association. Add remap/unmap controls to mapped sheet details and preserve the existing navigation/scroll cache.

- [ ] **Step 5: Verify Task 4**

Run: `npx tsx --test src/lib/sheet-mapping-resolution.test.ts src/lib/sheet-mappings.test.ts && npm run test:workspace-cache && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit Task 4 files only**

Commit message: `feat: let QA map Google tabs to test cases`

### Task 5: Enforce Read-only Workspace Behavior End to End

**Files:**
- Create: `scripts/verify-read-only-workspace.ts`
- Modify: `package.json`
- Modify: `src/components/qa-workspace.tsx`
- Modify: `src/app/actions.ts`
- Modify: `src/app/api/projects/[projectId]/evidence/route.ts`
- Modify: `src/app/api/projects/[projectId]/google-sheet/route.ts`
- Modify: `src/app/globals.css`
- Modify: `README.md`

**Interfaces:**
- Consumes `Project.canEdit`, `Project.canManage`, and `Project.canDelete`.
- Produces a consistent `ดูอย่างเดียว` workspace mode.
- Adds `npm run test:read-only` for regression verification of mutation guards.

- [ ] **Step 1: Write failing read-only regression checks**

Assert that every mutation entry point used by the workspace checks edit/manage/delete permission server-side and that UI actions for create, edit, result, defect, upload, pull, sync, mapping, settings, and approval submission are absent or disabled when `canEdit` is false. Include the allowlisted non-member and PO viewer cases.

- [ ] **Step 2: Run the regression test and verify RED**

Run: `npm run test:read-only`

Expected: FAIL because the script and consistent mutation guards do not exist.

- [ ] **Step 3: Add server mutation guards**

Centralize authenticated Project permission checks in a server-only helper and apply it to Server Actions and Project API mutations. Return 401 for unauthenticated and 403 for authenticated read-only users. Do not trust capability flags supplied by the browser.

- [ ] **Step 4: Add the read-only workspace presentation**

Show a `ดูอย่างเดียว` badge and concise explanation. Hide or disable mutation controls while preserving Overview, Test cases, Defects, Files, Settings information, image viewing, Sheet detail viewing, searching, and navigation.

- [ ] **Step 5: Document migration order and manual Supabase verification**

Update README with the migration filename and SQL verification cases for: allowlisted non-member SELECT success, mutation failure, QA mutation success, and owner/System Owner deletion. Note that the migration must be run before deploying UI code.

- [ ] **Step 6: Run full verification**

Run: `npx tsx --test src/lib/project-capabilities.test.ts src/lib/project-search.test.ts src/lib/sheet-mappings.test.ts src/lib/sheet-mapping-resolution.test.ts src/lib/sync/*.test.ts src/lib/workbook-cache.test.ts src/lib/workbook-loading.test.ts && npm run test:workspace-cache && npm run test:read-only && npm run typecheck && npm run lint && npm run build`

Expected: all commands PASS under Node.js 22+, with no new warnings. Run the documented Supabase SQL checks after applying the migration; every expected allow/deny result must match.

- [ ] **Step 7: Commit Task 5 files only**

Commit message: `feat: enforce read-only access across project workspace`

### Task 6: Browser Acceptance Verification

**Files:**
- Modify only if verification exposes a defect in files owned by Tasks 1–5.

**Interfaces:**
- Verifies the complete feature rather than producing a new runtime interface.

- [ ] **Step 1: Verify as an authorized non-member viewer**

Confirm all Groups/Projects are visible, Project search works, Test Case/Sheet details open, and no mutation control or direct mutation request succeeds.

- [ ] **Step 2: Verify as a QA editor**

Map an unrecognized tab, refresh, rename the Google tab without changing its `sheetId`, reload, confirm mapping persistence, remap it, then unmap it.

- [ ] **Step 3: Verify role boundaries**

Confirm QA can edit test data but cannot manage/delete outside existing permissions; QA Lead/Admin can manage; creator and System Owner can delete.

- [ ] **Step 4: Verify regression flows**

Run Project creation, Google pull/sync conflict dialog, Result/Defect editing, evidence preview, Approval review, and back-navigation cache flows.

- [ ] **Step 5: Record the verification result and commit any narrowly scoped fixes**

Commit message if fixes were required: `fix: address project access acceptance findings`
