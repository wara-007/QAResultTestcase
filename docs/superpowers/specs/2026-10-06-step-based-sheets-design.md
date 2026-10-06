# Step-based Google Sheets support

## Intent
Support the supplied EX: Stepname workbook as the main QA template without breaking legacy projects or modifying the original workbook during diagnosis.

## Model and presentation
- A Test Case owns ordered Steps. Blank TC ID rows with step content continue the preceding case; blank rows or section boundaries do not create cases.
- Preserve TC ID, scenario ID and description, positive/negative classification, raw Step name, description, expected result and original row/column references. Duplicate Step names are valid; identity uses sheet and source row, not the displayed name.
- Each Step owns its recorded status and multiple Results/evidence. Keep case-level Results for existing projects. Imported results that cannot be confidently mapped remain explicitly unassigned; never silently attach them to the wrong Step.
- User-approved amendment (2026-10-06): when no exact Step name exists in the owning case, match by Step number only if that number occurs once in that case. Report “จับคู่จากเลข Step” and preserve original Result content/source coordinates. Never use this fallback for duplicate numbers or conflicting definitions under an existing exact name.
- User-approved column preservation amendment (2026-10-06): retain every Step source column, including empty, unknown, duplicate-title and unnamed columns, with source coordinates. Show populated unmapped columns under their original titles (fallback: คอลัมน์ A/B/...). Detail Result fields use their nearby table column titles; definition values are omitted from Preview only when already represented by the selected Step. Preserve rich-text field references for the existing highlight enrichment. Unrecorded detail extras remain supplemental data, not proof of a test outcome.
- TESTING is shown as In Progress. Block is retained as Blocked. Unknown statuses preserve their original value and produce a validation warning rather than becoming Not Start.
- Case details and PO review present the same Step grouping, evidence and imported highlights. Counts clearly distinguish cases from steps.

## Cover and validation
- Project Overview shows Cover metadata (system, Jira, description, Sprint, QA, delivery date/version) and the sheet summary as a labelled source snapshot.
- Display calculated case/step status totals separately. Never treat Cover totals as authoritative or silently overwrite them.
- Validation reports incomplete import, conflicting totals/statuses, missing references, duplicate case IDs, unknown statuses and recorded Pass without Result/image evidence. Blocked/unstarted/unloaded Steps must not produce a fully passed case.
- Recorded QA status, system validation and PO approval are independent. Verification concerns completeness/consistency, not proof of functional correctness.

## Persistence and sync
- Persist Step definitions, source references and Step-result linkage through existing authenticated project storage. Refresh/reimport must preserve web-created Results, edits and evidence; identify conflicts rather than discard them.
- Detect the multi-Step template before syncing. Write only mapped cells/rows, preserving headers, merged cells, formulas, unrelated tabs, notes and highlight formatting. Do not invoke the legacy five-column header overwrite for this template.
- Cover is read-only in this change. No auto-edit of its formulas or totals.
- Continue supporting legacy one-row-per-case projects and existing approvals; no automatic destructive migration of old results.

## Verification
Test the supplied header shape and 14-step fixture, duplicate Step names, case boundaries, missing IDs, unknown statuses, partial imports, per-Step evidence, save/reopen, conflict detection, approval parity and write-range preservation. Verify the local UI with this workbook before claiming complete. No production Sheets writes, SQL execution or deployment without user authorization.
