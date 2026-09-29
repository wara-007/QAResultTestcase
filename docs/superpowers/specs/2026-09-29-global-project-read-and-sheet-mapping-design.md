# Global Project Read Access, Project Search, and Manual Sheet Mapping

## Goal

Allow every authorized application user to browse every Group and Project while preserving role-based mutation permissions. Add fast Project search and let QA users explicitly map an otherwise-unrecognized Google Sheets tab to an existing Test Case. A saved mapping must survive refreshes, workbook re-imports, and Google tab renames.

## Access model

The application uses global read access with role-based write access:

- Any account enabled in the application allowlist, including QA and PO accounts, can list every Group and Project and read Project content.
- Group membership continues to determine editing and management permissions; global visibility does not create Group membership.
- A Group owner, `admin`, `qa_lead`, or `qa` member can edit Project test data according to the existing edit policy.
- A Group owner, `admin`, or `qa_lead` member can manage Project configuration according to the existing manage policy.
- Only the Project creator or a System Owner can delete a Project.
- A System Owner retains full access.
- Users without edit permission see the Project in read-only mode. Mutation controls are hidden or disabled with an explicit `ดูอย่างเดียว` indicator.

RLS remains the source of truth. Client-side visibility of buttons is only a usability feature and cannot grant access. Server Actions and API routes must reject unauthorized mutations even if called directly.

## Group and Project browsing

The Groups page renders every Group as navigable for an authorized application user. It no longer labels non-member Groups as inaccessible. Group management controls remain visible only when `canManage` is true.

The Projects page renders every Project in the selected Group. Each Project carries explicit access capabilities returned by the server:

- `canView`
- `canEdit`
- `canManage`
- `canDelete`

Project pages use these capabilities to enter read-only mode. Read-only users can navigate Overview, Test cases, Defects, Files, and Settings information, but cannot submit mutations. Sensitive settings values such as credentials or secrets are never rendered.

## Project search

The Projects page adds one client-side search field above the Project grid. It searches the already-loaded Project catalogue using a normalized, case-insensitive comparison across:

- Project name
- Description
- Environment
- Sprint number
- Google Sheets URL or identifier

Search does not make a new network request. Clearing the search restores the existing ordering. A no-results state displays the query and provides a clear-search action. Creating or deleting a Project updates both the unfiltered collection and the current filtered view without requiring a reload.

## Manual Google Sheet mapping

The `แท็บอื่นใน Google Sheets` section contains tabs that automatic detection cannot associate with an existing Test Case. An editor can map each tab to one Test Case through a searchable selector.

For each unmapped tab, the interface provides:

- The Google tab name and detected kind/image count.
- A searchable Test Case selector showing ID and name.
- A `จับคู่` action.
- Clear saving and error states.

After saving:

- The tab disappears from `แท็บอื่นใน Google Sheets`.
- It appears as an additional source row for its target, for example `TC-18 (RC True prepaid)`.
- Opening that row uses the normal Test Case detail layout and filters Results, Defects, custom fields, and evidence to the mapped source tab.
- Future pulls and page refreshes reuse the mapping before applying automatic name-based inference.
- Editors can change or remove a mapping from the mapped tab detail view.
- Removing a mapping returns the tab to `แท็บอื่นใน Google Sheets` without deleting Test Case data or changing Google Sheets.

Mapping affects association only. It never renames a Google tab and never merges two Test Cases.

## Stable mapping identity

Mappings are persisted in a dedicated `project_sheet_mappings` table. Google `sheetId` is the stable source identity because a tab name can change. The latest tab name is retained for display and troubleshooting.

Each mapping contains:

- `project_id`
- `spreadsheet_id`
- `sheet_id`
- `sheet_name`
- `testcase_key`
- `mapped_by`
- `created_at`
- `updated_at`

The unique identity is `(project_id, spreadsheet_id, sheet_id)`. The Test Case reference uses the Project-scoped `testcase_key` rather than a volatile row number. A foreign key to `test_cases` is intentionally avoided because an imported Test Case may be visible from Google before its relational record has been persisted.

For legacy workbook metadata that does not yet include a Google `sheetId`, the UI may use a temporary name-based identity for display, but it must not persist a durable Google mapping until a real `sheetId` is available from the Sheets API.

## Mapping resolution order

When building Project Test Case rows, the system resolves a tab in this order:

1. A persisted mapping matching Project, spreadsheet, and Google `sheetId`.
2. Automatic Test Case ID inference from the tab name/content.
3. Unmapped placement in `แท็บอื่นใน Google Sheets`.

Persisted mappings always override automatic inference. If the target Test Case no longer exists, the mapping is shown as invalid and the tab returns to the unmapped section with a `Test case เดิมไม่พบ` warning. The system does not silently choose another Test Case.

## Database security

RLS is enabled on `project_sheet_mappings`.

- SELECT uses the global Project view predicate for authorized application users.
- INSERT, UPDATE, and DELETE require `private.can_edit_project(project_id)`.
- `mapped_by` must equal `auth.uid()` on insert/update.
- Anonymous users receive no access.

The existing read policies for Project-owned tables are updated to use the global view predicate. Existing insert, update, and delete policies continue using edit/manage/delete predicates.

The migration introduces a dedicated `private.can_view_project(uuid)` function. It returns true only when the caller has application access and the Project exists. `private.can_access_project(uuid)` remains as a compatibility alias to the view predicate so existing read policies and server code do not become inconsistent during rollout.

## Server and API boundaries

Project catalogue loading returns access capabilities alongside each Project. Capability calculation occurs on the server using database functions rather than inferred client-side from email or UI role labels.

Mapping endpoints are Project-scoped:

- `GET /api/projects/[projectId]/sheet-mappings`
- `PUT /api/projects/[projectId]/sheet-mappings/[sheetId]`
- `DELETE /api/projects/[projectId]/sheet-mappings/[sheetId]`

The PUT request accepts `spreadsheetId`, `sheetName`, and `testcaseKey`. The server verifies the authenticated user can edit the Project and verifies that `testcaseKey` exists in the current Project workspace or current Google summary before saving.

Google Sheet summary responses include each tab's numeric `sheetId`. No service-role credential or Google OAuth token is exposed to the browser.

## Error handling

- Unauthorized mutations return 403 and leave the UI unchanged.
- A mapping to a missing Test Case returns a validation error next to the selector.
- A renamed Google tab updates the stored display name when the same `sheetId` is next observed.
- A deleted Google tab leaves its mapping available for audit but excludes it from the active UI; a later cleanup may archive stale mappings.
- Failure to load mappings does not block the Test Case list. The unmapped section shows that saved mappings could not be applied and does not guess destructively.
- Concurrent edits to the same mapping use last-write-wins with `updated_at`; the UI refreshes the saved mapping after mutation.

## Testing

Automated tests cover:

- An allowlisted non-member can list and read all Groups and Projects.
- The same user cannot edit, sync, upload, map, manage, or delete without the required permission.
- QA, QA Lead, owner, and System Owner capabilities remain correct.
- Project search matches every specified field, ignores case/extra whitespace, and restores ordering when cleared.
- A mapping overrides automatic tab-name inference.
- A mapping survives a tab rename because `sheetId` is stable.
- Removing a mapping returns the tab to the unmapped section.
- An invalid Test Case target is not silently remapped.
- Mapping RLS allows global reads but restricts writes to Project editors.

## Acceptance criteria

- Every enabled application user can navigate every Group and Project and read its QA data.
- Users without write permission cannot change Project data through either the UI or direct API/database calls.
- Project search filters immediately without reloading the page.
- QA editors can map, remap, and unmap an otherwise-unrecognized Google tab.
- A saved mapping persists across refresh, re-import, sync, and Google tab rename.
- Mapped tabs are displayed exactly once under their selected Test Case and no longer appear in the unmapped section.
- Mapping never renames a Google Sheet tab or deletes QA data.
