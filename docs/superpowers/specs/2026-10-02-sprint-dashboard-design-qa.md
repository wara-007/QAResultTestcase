# Sprint dashboard design QA

Final visual result: **blocked**.

Reference: selected third Sprint dashboard mock, navy navigation, Sprint metadata, summary cards, Project rows, team contributions and attention items.

The authenticated local browser reached `/groups/default/years`, but the real database returned the missing planning migrations message. The actual dashboard could not be rendered against real data, so visual fidelity, responsive layout and interactive browser checks are not claimed as verified. No mock records were injected and no remote migrations were run.

Next check: apply both planning migrations in order, then inspect a real Sprint on desktop and mobile, Sprint editing, multiple QA assignment, moves with reason, and source/destination history. Automated database and aggregation tests cover the underlying behavior independently.

## Follow-up: management menu and deletion controls

After the user's migrations were applied, the real local Sprint dashboard rendered successfully. At the current narrow viewport, opening the native Project popover kept the first table row height at 74px and table width at 960px before/after. The menu was visible above the scroll container and closed with Escape. Group deletion confirmation opened, explained the full Project cascade, and was cancelled without deleting records. Actual cloud cleanup and live deletion were deliberately not executed against real user data. New Defect total SQL still needs user application; aggregation/database tests verify the new counts independently.
