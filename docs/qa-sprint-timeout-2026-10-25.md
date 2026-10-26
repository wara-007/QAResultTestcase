# Sprint dashboard statement timeout

Affected route: /groups/b5451207-986a-4ca6-88c0-8eda1e8d3972/years/2026/sprints/12fd29e3-6aed-40e4-97e4-c0a5b7a56820

Browser reproduction initially returned `canceling statement due to statement timeout`. Per-query diagnostics identified `sprint_project_counts` (`สรุป Project`) as the failing request. Its project_move_snapshot function repeatedly parses stored execution JSON including imported results/logs. The loader independently reads the same register and recalculates case totals.

Changes:
- Remove the duplicate aggregate RPC and derive totals from the already loaded register.
- Read register pages of ten with adaptive shrink on PostgreSQL57014, maintaining offsets and failing rather than publishing incomplete totals.
- Fetch only the latest nested execution per case.
- Preserve canonical defect totals using the latest source mapping and execution defects, deduplicating IDs/Jira with register precedence. Correct shared collectProjectDefects precedence when duplicate Jira records use different IDs.
- Report the failed data section in dashboard errors.

Verification:570 tests passed, production build passed, focused lint and diff checks passed. Reviewer found no remaining blockers after canonical defect regression was corrected.

Live verification is incomplete. Subsequent browser checks stalled; Chrome reached a signed-in pending-access screen. A separate read-only request for one Sprint ID also timed out after10seconds. No access permissions were changed. The query fix is verified with regression tests; successful live dashboard rendering must be confirmed when database/session checks respond again.
