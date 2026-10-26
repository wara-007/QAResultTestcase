# Sheets case authority

User request: when imported Testcase data differs, trust Sheets automatically.

- Import/refresh takes current Sheets register fields (including status and cleared text) and current workbook step definitions. No pull conflict dialog or manual choice pauses the import.
- Merge durable QA Results/evidence and web-only cases before replacing source-owned fields.
- Partial text responses cannot establish that step definitions were removed: keep saved steps/expected/definitions until the full workbook is available. A failed workbook request must leave usable saved step references.
- Explicit export/sync-back retains its separate conflict handling; this change applies to reading/importing Sheets.
- Preserve creator-owned Drive image uploads implemented in the preceding task. No real evidence files are moved or deleted.

Verification: updated authority tests were observed failing under the prior policy, then passing. Added latest-step/evidence preservation, resumed partial-save/failed-workbook, and partial-save followed by successful latest-workbook replacement regressions. Fourteen focused tests and 506/506 full tests pass. Production build/TypeScript, changed-file lint, read-only/navigation guards and whitespace checks pass. Independent review found and verified fixes for partial definition deletion and source accumulator contamination; final review approved. No real project data was overwritten for this controlled verification.
