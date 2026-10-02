# Sprint personal test performance

## Goal
Replace the Sprint team contribution table with per-tester case outcomes, including imported Sheets results. Show what each person tested and what assigned work remains. Never attribute imports to the importing user.

## UI
Title: ผลการทดสอบรายบุคคล. Columns: ผู้ทดสอบ, Projects, เทสแล้ว, Pass, Fail, In Progress, Skip, Not Start. Tested equals Pass plus Fail. Filter by Project, tester and source (all/web/Sheets). Expand a person into Projects. Selecting a status opens the matching case list with detail links. Include a ยังไม่ระบุผู้รับผิดชอบ row for unassigned unstarted cases and an unresolved-tester label for results lacking a usable tester identity.

## Counting
One outcome per project, case, source row and tester, using that tester's latest recorded result. Do not collapse separate source rows that share a TC identifier. Retests replace the previous status in this summary, but do not erase history. Multiple people testing one case each receive a personal outcome; their totals need not equal unique Sprint case totals. Normalize existing status spellings. Invalid/missing timestamps must not crash rendering; use stable saved ordering as fallback.

Web results use the stored tester identity/name rather than Project ownership or importer identity. Imported results use EXECUTED BY. Resolve exact normalized email or uniquely matched normalized display name against authorized group people; ambiguous names remain explicitly unresolved rather than being guessed. Preserve the displayed source name. Do not rewrite historical origin records to fabricate authors.

Current Sprint work and historical contributions remain distinct: new recorded web work keeps its original Sprint attribution after Project moves. Legacy/imported work with unknown original Sprint is displayed under the current Project Sprint with an inferred-source notice, not presented as certain historical activity.

## Case responsibility
Add persistent case-level responsibility, with bulk assignment from the Test cases list. A case may have multiple assigned QA people. Assigned people must be eligible group members. Project-level QA assignment is not automatically copied to every case.

Not Start belongs to assigned QA people with no started result for that case/source row; a person's existing started result takes precedence. Unassigned cases with no started results go in the unassigned row. Explicit Not Start results remain unstarted. Multi-assignee totals may overlap and the UI must explain this.

## Data and security
Keep aggregation in a pure tested module; use paginated metadata-only server queries, without loading images or live Sheets for the dashboard. Add a migration for case responsibility and scoped read/write policies. Only users already allowed to edit the Project can assign its cases. Read access follows existing Project visibility; group membership is validated server-side. Do not expand Project editing rights. Revoked/inactive accounts cannot receive new assignments, while historical names remain visible.

Users run Supabase SQL themselves. Do not apply remote migrations, delete real data, commit or push without a separate request. Existing Google Sheet content is not overwritten by this dashboard change.

## Verification
Test latest-result deduplication, multiple testers, separate source rows, imported names, ambiguous identity, missing timestamps, unassigned/multi-assignee Not Start, all filters, Project moves and unauthorized assignment. Verify UI expansion and status links, then full regression suite, typecheck, lint and build. Missing migration/query failures show an error, not misleading zero counts.
