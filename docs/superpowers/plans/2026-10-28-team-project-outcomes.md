# Team project outcomes implementation plan

**Goal:** Replace the team view's personal Pass table with the approved person/project report. Remove the six top-level metric cards on the team view only.

**Architecture:** Derive the report from the existing Sprint dashboard and personal performance inputs. No new requests or database fields. Use project QA assignments and recorded personal contributions without fuzzy identity matching. Keep unnamed/unassigned data in a separate verification section.

**Data limitation:** There is no Project closure field. Display actual PO approval and test states instead of inventing closure. Do not infer primary ownership from QA membership or treat an imported result timestamp as a delivery event.

**Files:** Add `src/lib/team-project-report.ts` and tests; add `src/components/team-project-report.tsx` and tests; integrate in `sprint-dashboard.tsx`; add scoped CSS in `globals.css`.

- [x] Test assignment-only projects, contributors, unknown identities, frozen history, review status, failures and missing counts.
- [x] Implement the report builder and member picker with project cards, next steps, links and expandable recorded results.
- [x] Integrate without the team's aggregate metric cards; retain overview, history and activity behavior.
- [x] Verify tests, types, lint, real browser selection/expansion and horizontal fit.

Approved by user after preview. Activity is shown only from saved result records; evidence links lead to actual test cases. The previous overview change remains intact.

Verification: 708/708 tests passed with bundled Node v24.22.1; TypeScript, full ESLint and diff whitespace checks passed. Actual Chrome team view verified member selection and expandable project detail; page/report scroll widths fit their visible widths; aggregate metrics absent. Numeric summaries use a nested strong element so the existing global body font-size override does not shrink them. Report derives from existing inputs without any additional reads. No database changes or deployment.

Follow-up: add project collaborators with exact distinct-case counts per person and a brief summary from up to two recorded case names. Completed tests count a case once when it has Pass/Failed; otherwise In Progress and Skip are separate categories. Assignments without results are identified separately; unverified aliases are not merged. Unknown testers are excluded from named collaborators. Tests cover duplicate result sheets, project isolation, aliases and assigned-only participants. Final suite 710/710, TypeScript, ESLint and whitespace checks passed; real browser collaborator sections and page fit without horizontal overflow.

View switch: added person/project presentation controls above the report. Project catalog includes every Sprint entry once, even without named participants, plus relevant recorded contributions. Project view shows authoritative QA, shared contributors and delivery state without attributing it to an arbitrary person. Native history API stores `teamBy=project` alongside `view=team`, keeping the loader in the same details mode without navigation requests. Default remains person view. Both modes retain independent local selection. Tests cover project uniqueness and an unassigned project's rendering. Final suite 712/712; types, full ESLint and diff checks passed. Chrome verified both URL states, immediate switches, project selection and no horizontal overflow.

Register-only follow-up: team now has a dedicated reader, separate from the activity/history loader. It reads imported Test cases rows (`source_row > 0`), latest status/tester/date/time columns in pages of 500, and excludes Cover/Summary. It never selects result_reference, Step/Result payloads, logs, evidence, result origins, or case assignments. Compact saved project summaries supply Defects; web metadata supplies QA and PO. Register attribution includes the named tester on Not Start cases and uses one current tester per register row. Prior detail-sheet contributors no longer affect team counts. Historical forwarded projects retain their saved aggregate header, without fetching personal Result/Step snapshots. A visible source note communicates this scope. Full suite 714/714 and TypeScript/ESLint passed; actual Chrome CORE Sprint verified the new basis and direct register counts. No schema changes.
