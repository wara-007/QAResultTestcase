# Sprint summary details implementation plan

**Goal:** Group the six Sprint metrics and expandable per-project counts in one section. Details are closed by default. Keep Projects ใน Sprint unchanged.

**Architecture:** Use native details/summary and existing dashboard entries. Current projects use saved counts; continued projects use frozen historical counts. No additional requests or packages.

**Files:** `src/components/sprint-overview-metrics.tsx`, its existing tests, and `src/app/globals.css`.

- [x] Verify rendered details start closed and list all six statuses per project, including missing summaries and continued projects.
- [x] Group metrics, summary line, and details in one overview panel; keep other dashboard views unchanged.
- [x] Style responsive metrics and a horizontally scrollable detail table. Preserve the existing pending-project notice and management table.
- [x] Run component tests, dashboard tests, TypeScript, ESLint and the project test suite.

Review focus: missing counts must remain unknown; historical rows must use frozen counts; table totals must match the cards; empty Sprints must remain usable; opening details must not trigger a request.

Execution: user approved the preview and explicitly requested implementation with details closed by default. Implement in the current workspace without a further approval step.

Verification: component tests 7/7; full src test suite 699/699 with bundled Node v24.22.1; `npm run typecheck`, `npm run lint`, and `git diff --check` passed. Initial suite execution used host Node v20 and failed five tests because native WebSocket is unavailable; rerunning with the supported runtime resolved all five. Chrome local Sprint page verified collapsed and expanded states with actual 122/105/0/0/16/1 totals and unchanged management table. Reviewed the diff for scope and data requests: no fetching code changed.
