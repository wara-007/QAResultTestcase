# Sheet loading performance implementation plan

**Goal:** Reduce repeated downloads and workbook parsing while retaining complete results and evidence.

**Architecture:** Reuse project-scoped workbook promises and completed navigation data in the browser. Cache read-only ZIP contents and sheet parsing by immutable ArrayBuffer identity; exports continue using fresh mutable ZIP contents. Explicit Sheets refresh invalidates cached downloads.

**Constraints:** No spreadsheet writes, no schema changes, preserve per-row status, text before image shimmer, no loaded status before evidence is available.

## Tasks

- [x] Add regression tests for cached detail readiness, download invalidation and repeated workbook sheet reads.
- [x] Reuse loaded detail/navigation snapshots and workbook bytes on case navigation; keep failed loads retryable.
- [x] Reuse ZIP/shared strings/sheet content for read-only workbook operations; preserve fresh exports.
- [x] Invalidate caches on explicit refresh; seed completed workbook cache after refresh.
- [x] Run full tests, typecheck, lint and whitespace checks. Report first-load limitations without inventing timing claims.

Verification: 172 tests passed; typecheck, lint and git diff --check passed. Live browser timings were not measured. The first evidence load still requires the spreadsheet XLSX; subsequent case navigation reuses its bytes and parsed sheets. Full refresh groups three tabs per request and invalidates the workbook cache; successful sync also invalidates stale evidence snapshots.
