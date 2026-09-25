# Google Sheets Sync Conflict Resolution

## Goal

Prevent data loss when the QA workspace and its connected Google Sheets workbook are both edited after the last successful synchronization. Before either side is overwritten, users must be shown the differences and explicitly resolve true conflicts.

The first release covers Test Cases, execution fields, custom fields, Results, and Defects. It also covers the special case where both sides independently create the same Test Case ID.

## User-visible states

Each connected project exposes one of four synchronization states:

- **Sync แล้ว**: the stored baseline, workspace, and Google Sheets agree.
- **ยังไม่ Sync**: only the workspace changed after the baseline.
- **Sheets มีข้อมูลใหม่**: only Google Sheets changed after the baseline.
- **มี Conflict**: both sides changed at least one overlapping value differently, or both sides independently created the same Test Case ID with different contents.

These states describe synchronization, not network connectivity. A failed Google request is shown separately and does not change the last known sync state.

## Canonical data model

Both Supabase data and Google Sheets data are converted to the same canonical project snapshot before comparison. A snapshot contains Test Cases keyed by normalized Test Case ID. Each Test Case contains:

- Core Test Case fields: ID, name, scenario, condition, steps, expected result, platform, and test data.
- Execution fields: status, device, app version, environment, tester, execution date/time, remark, and result reference.
- Custom fields keyed by normalized label plus source location.
- Results keyed by stable Result ID.
- Defects keyed by stable Defect ID.

Presentation-only values, generated formulas, sheet row numbers, and formatting are excluded from equality checks. Text is normalized only for comparison of identifiers and labels; user-entered field values retain their original whitespace and casing.

## Synchronization baseline

The system stores the canonical snapshot from the last successful two-sided sync. Baselines are stored per project and Test Case rather than as one large project JSON document.

Each baseline record contains:

- Project ID and normalized Test Case ID.
- Canonical snapshot JSON.
- Hash of the synchronized snapshot.
- Last successful sync timestamp.

RLS must restrict baseline reads to project members and writes to users who can edit the project. Baseline data is never accepted directly from the browser when calculating conflicts.

For projects that predate this feature, the first comparison creates a baseline only after the user reviews the initial preview. It must not silently assume either side is authoritative.

## Three-way comparison

For every field or child record, the server compares:

1. The last synchronized baseline.
2. The current workspace value from Supabase.
3. The current value from Google Sheets.

The comparison produces these outcomes:

- Neither side changed: keep the value.
- Workspace only changed: select the workspace value automatically.
- Google only changed: select the Google value automatically.
- Both changed to the same value: select that value automatically.
- Both changed differently: require a user decision.

Results and Defects with different stable IDs are appended automatically. A Result or Defect with the same stable ID follows the same field-level comparison rules. Missing records are not immediately treated as deletions; if the baseline contained the record, removal is presented as a delete-versus-keep decision.

## Same Test Case ID created on both sides

When an ID such as `TC-05` is absent from the baseline but exists on both sides:

- If the canonical snapshots are identical, merge automatically into one Test Case.
- If changes are non-overlapping, propose a single merged Test Case and allow review.
- If overlapping fields differ, show a conflict with four choices:
  1. **รวมเป็น Testcase เดียว** (recommended): choose conflicting fields individually; automatically retain compatible fields and distinct Results/Defects.
  2. **ใช้ข้อมูลในระบบ**: the workspace version becomes authoritative.
  3. **ใช้ข้อมูลจาก Google Sheets**: the Google version becomes authoritative.
  4. **เก็บทั้งสองรายการ**: retain one `TC-05` and require a new unique ID for the other copy.

When keeping both, the UI suggests an available ID but the user may edit it. The server validates uniqueness against the baseline, workspace, Google Sheets, and all renames in the current operation. Renaming also updates Result sheet names, references, hyperlinks, Defect references, and persisted Test Case keys as one logical operation.

## Conflict-resolution interface

The existing load and sync buttons first request a synchronization preview. If there are no conflicts, the UI displays a compact summary and allows immediate confirmation. If conflicts exist, a dedicated full-screen dialog shows:

- One section per Test Case.
- Workspace and Google values side by side.
- The baseline value for context.
- Per-field choices for true conflicts.
- Bulk actions: use all workspace values or all Google values.
- A keep-both/rename workflow for duplicate newly-created IDs.
- A final preview of additions, updates, renames, and deletions.

No data is written while the dialog is open. Cancel closes the dialog without changing either side.

## Safe apply workflow

The preview response includes hashes of the local and remote snapshots. On confirmation, the server reloads both sides and verifies those hashes. If either side changed while the user was reviewing, apply returns HTTP 409 and requests a fresh preview.

An apply operation is recorded with a unique operation ID and the resolved canonical snapshot. Applying is idempotent:

1. Validate permissions, decisions, IDs, and preview hashes.
2. Persist the pending operation.
3. Write the resolved snapshot to Google Sheets.
4. Persist the resolved snapshot to the workspace.
5. Replace the per-Test Case baselines.
6. Mark the operation complete.

If a step fails, the operation remains retryable. A retry uses the same operation ID and resolved snapshot rather than recalculating choices. The UI reports partial failure and does not claim the project is synchronized until both stores and the baseline are updated.

## API boundaries

Add authenticated project-scoped endpoints:

- `POST /api/projects/[projectId]/sync/preview`: returns sync state, automatic changes, conflicts, and snapshot hashes.
- `POST /api/projects/[projectId]/sync/apply`: validates decisions and applies the resolved snapshot idempotently.

The browser sends only user decisions and the preview hashes. Parsing Google Sheets, loading Supabase state, conflict calculation, permission checks, and final merge all remain server-side.

## Database changes

Add two RLS-protected tables:

- `test_case_sync_baselines`: per-project, per-Test Case canonical baselines and hashes.
- `project_sync_operations`: idempotent operations with status (`pending`, `google_written`, `complete`, `failed`), resolved snapshot, error text, actor, and timestamps.

Migrations must include indexes for project lookup and unique constraints for project/Test Case baseline identity. Policies must use the existing project access/edit functions rather than relying only on the `authenticated` role.

## Performance

Preview first performs lightweight revision/hash checks. Full Google tab content is loaded only when Google changed or no baseline exists. The canonical snapshot and hashes are reused for the subsequent apply request when their optimistic concurrency checks remain valid.

The separate optimization to avoid downloading the stored Excel workbook on the Testcases list remains compatible but is not part of this conflict-resolution change.

## Error handling

- Google authorization expiry prompts reconnection without discarding decisions.
- A changed preview hash returns a clear “ข้อมูลเปลี่ยนระหว่างตรวจสอบ” message and regenerates the comparison.
- Invalid or duplicate rename IDs block confirmation inline.
- Partial apply failures remain retryable and visible to project members.
- No destructive action occurs from an ambiguous missing row or tab.

## Testing

Automated tests cover:

- Workspace-only, Google-only, identical, and conflicting field changes.
- Same ID independently created with identical, non-overlapping, and conflicting values.
- Result/Defect union by stable ID and conflicts within the same stable ID.
- Delete-versus-edit decisions.
- Keep-both rename validation and reference updates.
- Stale preview rejection when either side changes before apply.
- Idempotent retries after each partial-operation state.
- RLS access for project viewers versus editors.

An integration test uses a representative workbook to verify that preview plus apply produces identical canonical snapshots in Supabase, Google Sheets, and the stored baseline.

## Acceptance criteria

- The system never silently overwrites a value changed on both sides since the last successful sync.
- Users can resolve conflicts per field or choose one side in bulk.
- Independently created duplicate Test Case IDs can be merged, resolved to one side, or retained by renaming one copy.
- Results and Defects with distinct stable IDs are preserved from both sides.
- Canceling conflict resolution writes nothing.
- Apply detects changes made after preview and refuses stale decisions.
- A completed operation leaves Supabase, Google Sheets, and the baseline canonically equal.
