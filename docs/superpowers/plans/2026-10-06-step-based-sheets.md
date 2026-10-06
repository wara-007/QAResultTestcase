# Step-based Google Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support EX: Stepname as the main workbook template, preserving every Step, its Results and evidence without breaking legacy projects.

**Architecture:** Detect the Step template before invoking legacy parsers. Use ordered source-row identities for Steps and explicit source references for Result boundaries; persist this additive model through project storage and render the same grouping for QA and PO. Generate template-aware write plans before calling Google APIs so the original register and Cover are never replaced by legacy headers.

**Tech Stack:** Next.js, React, TypeScript, existing Google Sheets/Drive and OOXML readers, existing Supabase project storage, node:test/tsx.

**Spec:** `docs/superpowers/specs/2026-10-06-step-based-sheets-design.md`

## Implementation verification — 2026-10-06

Implemented the additive Step model, source-section Results/image ownership, JSON persistence, QA/PO presentation, Cover Overview validation and safe template-specific execution-cell sync/export. Full regression suite: 210 tests passed; typecheck, lint and diff whitespace checks passed. Live localhost verified the supplied workbook's 14 Steps, three source Result sections and two correctly associated evidence images; Cover is excluded from cases and shown separately in Overview.

Preservation boundaries: source Step descriptions/expected definitions remain read-only in this UI; sync rejects changed source definitions and requires an exact existing detail tab. Managed web Result snapshots append outside the original grid rather than replacing source content. Original formulas are preserved in OOXML export. Unconfident Result ownership stays visibly unassigned.

Not yet verified against live storage: saving/reopening a new QA Result, PO session parity, or a real Google write/reimport. No production Sheets writes, SQL, deployment or commit/push performed. The detailed checkboxes below remain an audit list, not a claim that these live checks ran.

## Global Constraints

- Cover is read-only in this change and appears only in Project Overview, never as a Test Case.
- Blank TC ID rows with Step content continue the preceding case; duplicate Step names are valid.
- TESTING is In Progress; Block is Blocked; unknown statuses retain their original value and a warning.
- Keep case-level Results for legacy projects; unconfident Step mappings remain explicitly unassigned.
- Preserve web-created Results, edits, evidence, source coordinates and imported highlights across refresh/reimport.
- QA status, system consistency validation and PO approval are separate.
- No production Sheets writes, SQL execution, deployment or destructive migration during verification.
- Preserve the existing dirty worktree. Read relevant installed Next.js documentation before component changes.

## Review Focus

- A blank separator or repeated header must end continuation ownership, not attach a new section to the previous case (Task 1).
- Register and detail Step descriptions differ; Results must not be matched by display name alone (Task 2).
- Duplicate Step names and out-of-order Result sections must remain distinct or unassigned, never silently collapse (Task 2).
- Reimport after a QA edit must retain local Results and surface source conflicts (Task 3).
- A missing detail tab or incomplete image import must not imply complete validation or an all-passed case (Task 5).

### Task 1: Parse the main Step register

**Files:** Create `src/lib/step-testcases.ts`, `src/lib/step-testcases.test.ts`; modify `src/lib/types.ts`, `src/lib/testcase-rows.ts`, `src/lib/excel-ooxml.ts`.

**Interfaces:** Add `TestCaseStep` with `id`, `sourceSheetName`, `sourceRow`, `name`, `description`, `expected`, `rawStatus`, `status`, `device`, `environment`, `appVersion`, `executedBy`, `executedDate`, `resultReference`. `status` is `TestStatus | "Blocked" | "Unknown"`. Add optional `TestCase.stepDefinitions` and `TestResult.stepId`. Produce `parseStepTestCases(rows: unknown[][], sheetName: string): TestCase[] | null`; null means legacy template.

- [ ] Write fixture tests using the supplied A–R headers: one ENQ_01_TC_01 case with 14 Steps, including duplicate Step numbers; assert every original source row and status survives. Add blank separator, repeated header, second case and unknown-status tests.
- [ ] Run `node --import tsx --test src/lib/step-testcases.test.ts`; confirm failures before implementation.
- [ ] Implement parser and dispatch it before both existing Google row and OOXML legacy readers. Preserve scenario ID, scenario description and positive/negative classification as named fields; do not invent defaults for unmapped columns.
- [ ] Run new tests plus `src/lib/testcase-rows.test.ts` and `src/lib/excel-ooxml.test.ts`; expect all passing with legacy fixtures unchanged.

### Task 2: Separate detail Results and assign evidence by Step

**Files:** Create `src/lib/step-sheet-results.ts`, `src/lib/step-sheet-results.test.ts`; modify `src/lib/google-sheets.ts`, `src/lib/excel-ooxml.ts`.

**Interfaces:** Produce `parseStepSheetResults(rows: unknown[][], testCase: TestCase, sheetName: string): { results: TestResult[]; issues: string[]; representedCells: Set<string> } | null`. Result source ranges determine image ownership; retain source section boundaries and existing rich-text highlight offsets.

- [ ] Inspect the entire live ENQ_01_TC_01 detail tab read-only, including Result Testing boundaries and drawing anchors, to finalize fixtures. Never print credentials.
- [ ] Write failing tests: definition rows excluded from Results; two Result sections remain separate; duplicate names/out-of-order or conflicting detail definitions are unassigned with issues; images belong only to their containing Result section; unknown text is retained without duplicate preview content.
- [ ] Run `node --import tsx --test src/lib/step-sheet-results.test.ts` and confirm failure.
- [ ] Implement the Step detail branch before generic freeform parsing. Confident matches require source/definition identity; do not infer Pass from images. Exclude Cover and Defect tabs before synthetic Test Case creation.
- [ ] Run Step tests plus sheet-detail, sheet-section and image-import regression tests; expect all passing.

### Task 3: Persist Step definitions and Result links safely

**Files:** Modify `src/lib/project-data.ts` and existing workspace merge helpers; create `src/lib/step-reconciliation.ts`, `src/lib/step-reconciliation.test.ts`.

**Interfaces:** Produce `reconcileStepCases(stored: TestCase, incoming: TestCase): { testCase: TestCase; issues: string[] }`. Existing authenticated project storage must serialize/restore `stepDefinitions` and `stepId` without altering authorization.

- [ ] Write failing tests for serialize/load roundtrip, reimport with edited web Result, changed source Step description and removed source Step with existing evidence. Assert stable identity and explicit conflicts instead of data loss.
- [ ] Run reconciliation tests and observe failure.
- [ ] Update persistence and merges using the existing stored JSON payload. Retain legacy case-level Results; if a database change is unavoidable, supply an idempotent migration for the user to run, never execute it.
- [ ] Run tests and `npm run typecheck`; expect passing.

### Task 4: Present/edit Steps consistently for QA and PO

**Files:** Create `src/components/test-case-steps.tsx`, `src/lib/step-presentation.test.ts`; modify `src/components/qa-workspace.tsx`, `src/components/review-workspace.tsx`, `src/lib/project-review.ts` and relevant existing CSS.

**Interfaces:** Shared `TestCaseSteps({ testCase, readOnly, onChange }: { testCase: TestCase; readOnly: boolean; onChange?: (testCase: TestCase) => void })`; shared `resultsForStep(testCase: TestCase, stepId: string | null): TestResult[]` groups unassigned/legacy Results separately.

- [ ] Write failing rendering/grouping tests: 14 visible Steps, duplicate names distinct, status controls in QA only, matching PO content, unassigned Results clearly labelled and no duplicate evidence.
- [ ] Run presentation tests and observe failure.
- [ ] Implement shared Step grouping, select the owning Step when adding/editing a Result and preserve per-Result save/cancel behavior. Display case count separately from Step count; keep legacy UI when no Step definitions exist.
- [ ] Run tests, typecheck and lint. Verify local save/reopen and PO read-only grouping without submitting an approval.

### Task 5: Cover Overview and independent validation

**Files:** Create `src/lib/workbook-validation.ts`, `src/lib/workbook-validation.test.ts`, `src/components/workbook-summary.tsx`; modify source metadata persistence, `src/lib/google-sheets.ts`, `src/components/qa-workspace.tsx`.

**Interfaces:** Add optional `WorkbookSource.coverSnapshot` containing original named metadata and labelled totals. Produce `validateWorkbook(cases: TestCase[], source: WorkbookSource): { issues: { code: string; message: string }[]; caseCount: number; stepCount: number; statusTotals: Record<string, number> }`.

- [ ] Write failing tests: Cover 1 scenario/14 TestCase is compared to Step totals rather than 14 distinct case IDs; conflicting counts, unknown status, duplicate case IDs, missing references, incomplete tab/image loading and Pass without Result/image produce issues. Blocked/unloaded Steps cannot yield fully passed validation.
- [ ] Run validation tests and observe failure.
- [ ] Read/persist Cover metadata separately and render in Overview as source snapshot beside calculated totals and warnings. Do not overwrite QA status or PO decisions.
- [ ] Run validation and Cover exclusion regressions; verify Cover absent from both QA/PO case lists and present in Overview.

### Task 6: Non-destructive sync/export and end-to-end verification

**Files:** Create `src/lib/step-sheet-sync.ts`, `src/lib/step-sheet-sync.test.ts`; modify `src/lib/google-sheets.ts`, `src/lib/excel-ooxml.ts`.

**Interfaces:** Produce `buildStepSheetWritePlan(cases: TestCase[], headerRows: unknown[][]): { range: string; values: unknown[][] }[]` containing only mapped execution cells; preserve original definitions and formulas. Append web-created Result blocks in a dedicated owned area, not over existing source sections. Missing/ambiguous ownership rejects the write with an actionable message.

- [ ] Write failing tests proving A1:E1 is never replaced, merged definition cells untouched, duplicate Step rows written independently, unmapped/formula cells preserved, Cover never written, and unknown schemas rejected without API mutation.
- [ ] Run sync tests and observe failure.
- [ ] Route detected Step templates through the safe write plan for Sheets and OOXML export; never invoke legacy header replacement or destructive Result-tab rewrite for this template.
- [ ] Run `node --import tsx --test src/lib/*.test.ts src/lib/sync/*.test.ts`, `npm run typecheck`, `npm run lint`; retain command results as evidence.
- [ ] Verify the EX: Stepname local project: correct case/Step counts, complete text/images, Step Result edit/save/reopen, no duplicate previews, Cover Overview and matching PO review. Validate generated sync ranges locally; do not write to the real workbook.
- [ ] Review the final diff for compatibility and preservation of user edits; report any unverified live behavior explicitly. Commit/push only when separately requested.
