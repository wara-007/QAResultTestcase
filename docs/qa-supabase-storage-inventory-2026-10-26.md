# Supabase inventory — 2026-10-26

Read-only inspection. Amounts below are registered source_files.byte_size totals in decimal GB, not a physical bucket scan or billing-period average.

## Database

- Groups:11; projects:37.
- test_cases rows:912; test_executions rows:912. These are database rows and may include legacy sheet-only snapshots.
- Source versions:187; approval requests:10; Sprint snapshots:2.
- Normalized evidence and defects tables currently have0rows. Actual nested result/defect/evidence metadata is persisted in the stored result JSON envelope.

## Storage

One private bucket: testcase-source-files. Stores original imported/exported XLSX workbooks, including embedded images. Large workbooks are split into part-* objects.

- Registered workbook bytes:3,732,626,197 (3.73GB).
- Latest version per project:698,003,861 (0.70GB),37 versions.
- Older versions:3,034,622,336 (3.03GB),150 versions,81.3% of registered bytes.
- Old version does not mean unreferenced: history/Sprint snapshots must be checked before cleanup. Failed partial/orphan objects are not included in this inventory.

| Project | Versions | Total MB | Older MB |
|---|---:|---:|---:|
| Regression : TrueApp preprod 11.1002.0 | 31 | 787.3 | 677.5 |
| test | 10 | 763.3 | 687.0 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 15 | 561.5 | 524.0 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 7 | 418.7 | 346.8 |
| Result Testing [SUN-3503] Bill and Usage phase 1 | 3 | 266.4 | 177.6 |
| Pay ban cancel | 6 | 197.1 | 164.3 |

## Other storage

Separately uploaded evidence uses Google Drive; Supabase stores its file IDs and metadata. Original XLSX files still contain their own embedded images, so evidence being in Drive does not eliminate workbook storage in Supabase.

No files or records were deleted.
