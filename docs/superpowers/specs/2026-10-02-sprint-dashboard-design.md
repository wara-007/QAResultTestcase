# Sprint dashboard and historical ownership

Approved direction: third displayed mock (Project Control Desk), with Thai copy and existing navy/blue tokens. Adapt Team contributions to multiple QA per project; no individual completion percentage without per-case assignments.

## Behavior
- Sprint metadata (name, dates, goal, Planned/Active/Completed) editable by Sprint creator or group manager/System Owner, with immutable audit history and optimistic concurrency.
- Project managers assign multiple registered QA from the group. Responsibility does not grant edit permission.
- Move within group requires reason. Current dashboard excludes moved-out projects and includes moved-in projects. A separate moved-out section shows immutable before-move status counts, actor, date and destination, linking to current project.
- Existing project identity, cases, results, defects, approvals, Sheets remain intact. Project history includes move snapshot atomically in PostgreSQL.
- Each Result has immutable Sprint origin and original author identity captured by database on first save. Editing/deleting/readding same result cannot reattribute it. Imported/legacy results are marked inferred and not credited to the importing QA.
- Team contribution counts results and distinct cases per original author/origin Sprint, including moved-out projects. Current Project status instead includes all its Results.
- Legacy origin is unknowable: backfill current Sprint as inferred, label it explicitly. Never invent original QA or historical Sprint.
- Dashboard uses saved database records, not slow live Sheet/media requests. Empty, error, permission and pagination states included.
- No remote SQL execution, deployment or push in this task.

## Layout
Left Sprint navigation; heading and edit action; four metrics; Projects row table with search/QA filter; team contributions and actionable attention; moved-out snapshots; history. Tabs are URL query state; refresh preserves selection.
