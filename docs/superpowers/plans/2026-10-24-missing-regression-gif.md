# Missing Regression GIF evidence

Observed project `06b4525f-26b2-46b8-b18b-9f8ddd1a700f`: source version 4, 54/54 text tabs loaded, 106/107 expected evidence targets saved. The missing target belongs to `SUN-8073_01`.

Read-only inspection of the stored workbook confirmed that the missing image is `image104.gif`, 24,629,535 bytes (23.5 MiB), with the expected source anchor/hash. A second GIF (3,653,356 bytes) is saved. GIF compression intentionally preserves animation, but the shared validator capped every image at 10 MiB. The missing large GIF was therefore rejected. A text-loaded checkpoint can also remain loaded while image readiness is incomplete; hiding the warning would permit incomplete evidence.

Changes:
- Accept GIFs through 25 MiB, preserving their original animation/bytes. Other images remain 10 MiB; videos remain 25 MiB. Update picker copy.
- Return exact missing manifest targets, keeping evidence readiness blocked until every target is persisted.
- Show missing tab/count even when the progress panel is collapsed; loaded text is labeled as text and a missing-image tab is not presented as fully loaded.
- Keep the actual per-sheet upload error visible instead of swallowing the reason behind a generic incomplete notice.
- Live retry exposed a second 10 MiB limit in Next.js proxy request cloning. The bundled `proxyClientMaxBodySize` guide confirms that oversized bodies are truncated rather than rejected early. Set the bounded proxy buffer to 26 MiB so a valid 25 MiB file plus multipart headers reaches the handler. Production build/TypeScript and config lint pass; independent review approved this follow-up.

Follow-up refresh verification found a statement timeout on the embedded case/execution workspace query. Workspace reads now use stable pages of 10 instead of 500, without changing the default for other `readAllRows` callers. A regression rejects oversized reads and verifies all 62 proof references survive. Group six detail tabs per Sheets request instead of three to reduce repeated register/metadata/formatting reads; this workbook uses nine groups instead of eighteen.

Verification: three initial regression tests were observed failing, then passing; the subsequent workspace read regression also failed before the fix. All 510 source tests pass. Production build/TypeScript, changed-file lint, whitespace and read-only/navigation guards pass. Independent review approved the GIF, proxy buffer, grouping and paging fixes. Live database source version 6 confirms complete=true, refreshRequired=false, 107/107 proof targets persisted with no missing targets. Both GIFs are attached to SUN-8073_01. Browser refresh reads all 62 cases successfully and finishes its version check with 100%, 107/107 images, 54/54 tabs and no error/warning. Screenshot: `regression-gif-complete.png` in this task's visualization directory. Temporary diagnostic workbook copy removed.
