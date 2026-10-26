# Pay ban cancel: Ref parsing repair

Project `4b93c6ff-65b4-4f6a-b940-96db3e63889a` had 20 tabs under “other sheets” despite register references.

The original register has K=`Result Testing` (status) and N=`Ref (Result Testing)` (destination). The reader incorrectly treated K as the reference because `result testing` was also a reference-column alias, storing `PASSED` as the reference. That alias now belongs to status only.

Some Ref cells have different display text and hyperlink destinations: N21 displays `CAN_02_TC01 - CAN_02_TC06` but points to `CAN_02!A1`. Readers now resolve links only from the declared Ref columns, preserve the displayed text, and store actual target tab names separately. Google gid links must belong to the current spreadsheet; external spreadsheet links cannot select local tabs.

The workbook has 42 register rows with 38 distinct IDs. Repeated IDs retain the union of their referenced tabs when consolidated for storage, so CAN_06 and CAN_07 can both belong to the repeated CAN_06 case IDs. Original source rows remain in the workbook.

Offline validation: 38 distinct cases, no missing-reference warnings. Remaining unowned result tab CAN_01_TC06 is correct: its register row links to CAN_01_TC05. Data test is also unowned. Tests: 545 passed, production build and focused lint passed. Payment workbook regression still maps 72 unique images correctly.

Live follow-up: corrected Ref values and resolved targets survive reopening the page; the other-tabs section now shows exactly Data test and CAN_01_TC06. A database timeout occurred while reloading the saved project. Project reads now opt into reducing page size on statement timeouts, retrying the same offset and failing if even one row cannot be read. Legacy tab snapshots are also prevented from overriding registered Ref ownership during evidence import. The final suite has 548 passing tests; build and focused lint passed.

Final live verification: source version 5 is complete with refreshRequired=false; readiness=true; evidence 83/83 targets persisted; all 23 tabs loaded; 38 unique registered cases remain (41 displayed case/tab associations). Other tabs are exactly Data test and CAN_01_TC06. Every referenced evidence owner is a registered case; the only non-register manifest owner is the deliberately unreferenced Data test preview. Screenshots saved in the chat visualization directory. No source-sheet values were changed.
