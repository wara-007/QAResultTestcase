# Payment evidence import repair — 2026-10-25

Project: `dd6e9920-75cf-47b5-b77b-a305e6776a60`.

The saved workbook contains 27 registered cases and 72 embedded images. Before repair the persisted manifest had 55 images; 17 images in nine tabs referenced nonexistent case IDs derived from tab names.

- Use the register's explicit `Ref Result Testing` as well as registered IDs to resolve workbook tab owners. Examples: FG01 belongs to FG01_TC01 and FG01_TC02; CAN_01 belongs to CAN_01_TC01.
- Scope inline Step/Result Testing tables by their explicit case-ID column. Repeated Step names in a combined tab must not attach one case's results or images to the other case.
- Accept CR/LF in registered case IDs containing annotations, such as `DCB01_TC01\n*U01`. Preserve the case ID and flatten line breaks only in the Drive folder label. Continue rejecting other control characters and checking project edit access before accessing the creator's Google connection.
- Owner-scoped inline results use mapping version 2. On refresh, discard obsolete automatically imported Step snapshots only if they have no saved evidence, local edits, or mapping history. Preserve QA-authored results and saved proof.

Offline verification against the exact stored workbook: 27 cases, 72 images, 72 distinct physical image anchors, all image owners registered. FG01 maps two images to its first case and one to its second; DCB03 maps one image to each case.

Live recovery verified through the project's normal Resume Import button: all 72/72 evidence images persisted, 23/23 tabs loaded, 27 cases retained. UI now shows `บันทึกหลักฐานครบแล้ว 100%` and no missing-evidence warning. Validation: 524 automated tests pass, production build and focused lint pass, read-only workspace guard passes. Creator Drive routing remains enforced.
