# External result references

Approved direction: match local tabs first for plain names/Jira labels; preserve external document links and display them without downloading external files. Keep register Status and saved results/evidence. No push/deploy.

- Add safe HTTP(S) reference-link metadata; reject unsafe links. Preserve native gid/range matching and shared Ref ownership.
- Parse Ref cells on standalone rows too; distinguish external filenames/URLs from missing local tabs.
- Round-trip link metadata through saved results, workspace merges and review data.
- Show external/reference links in case details and PO review with explicit not-imported text. Read old reference metadata using the existing summary endpoint, without workbook/image downloads.
- Add regression tests for local/Jira/external links, shared documents, unsafe URLs and persistence; run tests/lint/build. Preserve pre-existing edits.

## Verification

Implemented safe link metadata and persistence, native/Jira target ownership, external-file classification, UI links in edit/preview/PO review, and legacy summary-only metadata refresh. External references never trigger HTTP downloads by this feature or create result tabs. Old friendly labels upgrade too, and Jira enterprise context paths are supported.

- Regression tests observed failing before implementation, then passing.
- Full suite: 679 passed, 0 failed. ESLint clean; production build passed including TypeScript.
- Independent review findings (friendly-label migration and enterprise Jira) addressed with regression coverage.
- Live authenticated local MRS-5359: shows Sanity Testcase_CR23355.xlsx with the actual SharePoint URL, explicit not-imported notice, Pass status, and no console errors. Did not open/download the external document.
- Screenshot: /tmp/qa-external-ref-2026-10-27.png.
- Existing dirty case-register-table and no-Step parser fixes retained. No commit, push, deployment, source-Sheets edit, or external-document import.
