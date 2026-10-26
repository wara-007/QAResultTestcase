# Proposal: Sheets import without accumulating workbook copies

Status: implemented after user approval; see qa-sheets-storage-migration-result-2026-10-26.md for live verification and separately authorized cleanup.

## Implemented scope

Remove the per-case Preview action and standalone workspace Preview mode. Existing Preview URLs redirect to the regular case detail page. Keep the shared read-only renderer used by Sprint history, normal case details, result evidence, and editing. Preview removal itself deletes no stored files; subsequent cleanup required separate verification and explicit-list approval.

## Recommended import flow

1. Keep the Sheets file ID and last successfully imported revision. On refresh, check for changes; unchanged sources use the saved workspace.
2. For a changed source, download a temporary XLSX for the existing OOXML parser to extract embedded images and results. Avoid storing the workbook permanently in Supabase Storage.
3. Treat every register row as an independent case, use Ref (Result Testing) to associate result tabs, and allow shared evidence references.
4. Save structured cases/results to the database and evidence files to the project creator's Drive. Deduplicate evidence by content hash within the project, with bounded parallel upload and retries. Import all evidence without requiring users to open cases.
5. Persist progress and each saved Drive file reference. Display counts of completed cases and saved evidence. Interrupted imports resume pending evidence; completion requires all required evidence, including GIFs, to be saved.
6. Mark a source revision complete only after reconciliation. Keep previously complete data visible while updating. If Sheets changes during extraction, queue another update instead of mixing revisions.

## Alternatives

- Read cells directly using the Sheets API: smaller transfers, but cell reads alone do not replace extraction of the embedded images handled by the existing OOXML path.
- Retain one latest workbook in Supabase: a smaller migration and useful retry cache, but large workbook transfers and duplicate image storage remain.
- Temporary workbook plus structured data and Drive evidence (recommended): removes ongoing XLSX accumulation while keeping the existing parser. Requires replacing workbook-dependent recovery and export first.

## Dependencies before switching imports

- Recovery currently reads saved source workbooks. Use a temporary import job artifact with a defined expiry, or re-download the same source revision; retain already-saved evidence references and restart if that revision is no longer available. Do not claim resumability from a manifest alone when image bytes are unavailable.
- Normal case views must render from persisted structured results and Drive references, including any source context needed by those views. Test with workbook loading disabled.
- Export must build from saved case/result data and Drive evidence, or explicitly fetch the current Sheets source when preserving its layout is requested. Do not silently substitute current data for historical Sprint exports.
- Sprint/PO snapshots need immutable structured records and evidence references, plus preserved historical artifacts where required. Removing case Preview does not remove these obligations.
- Define how uploaded local Excel files are retained separately; they cannot be recovered from a Sheets link.

## Existing storage cleanup

After the new flow is verified, inventory source files and their Sprint/PO/export references, provide a reviewable deletion list, and migrate or retain referenced history. Delete only approved unreferenced copies. No automatic deletion is included in this change.

## Acceptance checks for the future implementation

Import all images without opening case pages; retry a failed upload without re-uploading saved content; refresh unchanged Sheets without a new workbook version; update changed Sheets with visible progress; preserve repeated row IDs and shared Ref results; render details and export while no permanent XLSX is present; verify creator-owned Drive access for another editor and for PO; preserve historical Sprint exports.

## Implementation notes (2026-10-26)

Implemented metadata-only persistence for explicit Google imports (including Excel documents accessed through a Drive link). Local UploadDialog imports remain durable XLSX uploads, even on a linked project. Source metadata versions keep mapping/checkpoints and zero physical byte size. Existing Storage sources continue to work.

Workbook hydration pins the held source ID and uses a matching source-specific memory cache. For metadata-only sources the server checks Drive revision before/after export, or checks the downloaded OOXML content hash directly for `xlsx-v2:` revisions. The latter avoids three downloads of the same large file. If the source changed, export/recovery asks for a Sheets update instead of combining new bytes with old row positions. Current-layout export still needs access to the linked Sheets document; there is no new independent spreadsheet generator.

Cleanup is conservative and separate from imports. The command is dry-run by default and requires the reviewed fingerprint to apply. It retains latest sources, every case/export/history/approval reference, and sources without positive matching Sheets provenance. It verifies that each project has either ready persisted evidence or a physically complete latest original before considering older copies.

During apply a service-only, expiring database lease excludes guarded source/reference writers. Shared advisory transaction locks drain pre-existing writes before inventory; strict renewal cannot reacquire missing/expired leases; bounded network calls and pre-delete freshness checks fail closed. Source metadata is retained with an audit marker after exact object deletion. The private lease table has RLS enabled; no end-user role can acquire or release the lease. Reads remain available during cleanup. The lease is released in finally and expires automatically after ten minutes if the process dies.
