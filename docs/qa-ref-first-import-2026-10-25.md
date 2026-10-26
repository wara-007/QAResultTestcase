# Ref-first result import

The Testcase register remains the case list. Its `Ref (Result Testing)` values identify the source result tabs, including multiple cases referencing a shared tab. Both the Google Sheets reader and the browser/Excel import read referenced tabs first, while retaining other real tabs for inspection.

Explicit references override matching case-ID tab names, cached owner IDs, and saved mappings. An unmapped tab must not attach to a real case merely because their names or canonical IDs match. Shared inline result tables keep ownership scoped to each case's rows and Steps; rendering the register no longer copies another registered case's results from a shared tab.

Missing referenced tabs create a warning on their own case. Cases and saved proof remain intact, including workbooks with only the Testcase register. After the tab appears or Ref is corrected, the next successful refresh clears only the obsolete reference warning. Other import warnings and QA edits remain preserved.

Verification: 538 automated tests passed, focused ESLint passed, production build passed. The cached Payment workbook still resolves 27 cases and 72 unique embedded images to registered owners, with correct FG01/DCB03 image ownership. No live import or Google Drive modification was required for this follow-up.
