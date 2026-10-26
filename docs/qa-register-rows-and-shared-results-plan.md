# Preserve register rows and share referenced results

Approved requirements: each register row is a separate case, even when the displayed Testcase ID repeats. Different cases can share a referenced result tab and evidence. A row with its own result continues to work. Do not infer a new hierarchy from a tab name alone.

Implementation:
1. Assign stable internal identities to repeated register rows using source ID, Scenario context, definition fingerprint and occurrence. Preserve legacy IDs for the prior last-row record and align known identities on refresh. Keep the displayed Sheet ID separate. Do not merge rows or delete saved results.
2. Resolve Ref/hyperlink targets per row, keeping each row's own targets. Route shared source results to every actual referencing row; keep explicit case/Step blocks separate.
3. Persist row identity in the existing result envelope; no schema migration. Keep raw source IDs on screen and in exports, and show Scenario/row context when IDs repeat. Preserve old links and QA edits on their original records.
4. Reuse saved imported evidence and concurrent uploads by source hash; each referencing result gets the same file reference. QA-authored result edits remain local to their case.
5. Regression tests: single case, shared Ref, duplicate IDs with different/same Ref, inserted/reordered rows, save/refresh, source-result boundaries, evidence reuse, raw ID rendering/export. Verify the exact workbook has 42 register rows rather than 38 merged cases before live recovery.

Implemented and verified (2026-10-25):
- Repeated IDs now retain each source row and its own Ref targets. Last-row legacy IDs remain valid; other rows have internal keys with original IDs displayed plus Scenario/row context.
- Row identity persists with the existing stored result envelope. Refresh aligns source rows before merging results and remaps source sheet associations. Step definition differences participate in identity fingerprints.
- Generic shared proof and compact/API shared sections use registered Ref owners. Explicit inline case/Step blocks retain their own ownership.
- Imported physical evidence uploads share a promise by source sheet/hash and reuse saved imported files; each case attaches its own reference.
- Safe sync appends independent QA snapshots to Ref destinations, allocates separate ranges on shared tabs, checks register locations, and writes only execution columns. Snapshot identity prevents cross-case reassignment after reordering. Excel export/reopen preserves duplicate source IDs and independent QA results.
- All 564 tests in the complete suite passed; the additional export/reopen regression also passed. Production Next build, focused ESLint and read-only workspace checks passed.
- Exact cached workbooks: Pay ban has 42 rows (38 distinct displayed IDs); Payment retains 27 cases and 72 physical images. Native and OOXML parsing produce identical row identities for both workbooks.

Live verification completed:
- Pay ban source version 6: complete=true, refreshRequired=false, 42 registered rows, all 239 evidence references persisted, 23/23 tabs saved, evidence readiness=true.
- Refreshing the saved project retains both CAN_05_TC05 rows: row43 CVG and row44 Corp. Preview opens the generated-key row with its own source definition and shared CAN_05 results/images.
- Remaining unreferenced tabs are Data test and CAN_01_TC06 (register Ref explicitly points CAN_01_TC05); no source ownership is inferred to hide them.
- Final full suite:565 passed. Additional display-ID regression passed; focused export/display suite21 passed. Final production build and focused lint passed after label fixes.
- Screenshot: /Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/pay-ban-separate-register-rows.png
