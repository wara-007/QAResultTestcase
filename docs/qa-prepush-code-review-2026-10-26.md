# Pre-push code review — 26 ตุลาคม 2026

ผลรีวิวเดิม: **พบ 8 จุดที่ต้องแก้ก่อน push**

สถานะหลังแก้: **แก้ครบทั้ง 8 findings และ regression ที่พบระหว่างรีวิวซ้ำแล้ว** ดูผลตรวจล่าสุดท้ายเอกสาร รายละเอียดด้านล่างเก็บไว้เป็นหลักฐานของปัญหาเดิม

Scope: tracked working-tree diff และไฟล์ใหม่ เทียบกับ HEAD `f2f2615` ครอบคลุม auth/mail/creator Drive, import/parser/Ref/identity/sync, source persistence/cleanup/database และ UI/configuration ประสาน independent reviews 3 ส่วน การรีวิวไม่แก้ product code และไม่เรียกบริการจริงเพื่อส่งเมล ลบไฟล์ หรือเขียน Sheets

## P1 — 1. สลับแถว ID/definition ซ้ำแล้วผล QA กับ URL สลับเจ้าของ

ตำแหน่ง: `src/lib/register-case-identity.ts:30-34`, matching ที่49

กรณี: TC01 สองแถวมี definition เหมือนกัน แต่ Ref เป็น Proof A กับ Proof B บันทึก web results แยกกัน จากนั้นสลับลำดับแถวใน Sheets แล้ว refresh

ผลที่ยืนยันได้: Proof B ได้ `QA result for Proof A` และ Proof A ได้ `QA result for Proof B` พร้อม internal IDs/URL ของอีกแถว เพราะ fingerprint ไม่ใช้ Ref และ occurrence อิงลำดับ

ควรแก้: ใช้ Ref ที่แยกแถวได้เป็น tie-breaker แบบจับคู่หนึ่งต่อหนึ่งก่อน occurrence สำหรับกลุ่ม definition ซ้ำ โดยยังรักษา URL เมื่อแก้ Ref ของแถวเดิม เพิ่ม regression test ทั้ง reorder และ Ref edit

## P1 — 2. Ref ที่ resolve ถูกแล้วกลับไปเขียนผิดแท็บ

ตำแหน่ง: `src/lib/register-result-write-plan.ts:13`, `src/lib/sheet-mapping-model.ts:21-28`

กรณี: มีแท็บ Proof_A และ Proof-A โดย Proof_A อยู่ก่อน และ hyperlink Ref ระบุ `'Proof-A'!A1`

ผลที่ยืนยันได้: resolver คืน Proof-A ถูกต้อง แต่ association ให้ทั้งสองแท็บเป็นผลของ TC01 และ write planner เลือก Proof_A เพราะ referenceKey ลบ `_`/`-`/ช่องว่างออก

ควรแก้: จับคู่ชื่อแท็บจริงแบบ exact ก่อน ส่วน normalized fallback ต้องยอมรับเฉพาะเมื่อมีตัวเลือกเดียว ห้ามเลือกตัวแรกเมื่อกำกวม

## P1 — 3. Checkpoint ของ Sheets ไม่ใช่หลักฐานว่าไฟล์มาจาก Sheets

ตำแหน่ง: `src/lib/source-storage-cleanup.ts:23`, checkpoint ของไฟล์เดิมที่ `src/components/qa-workspace.tsx:2177`

กรณี: อัปโหลด Excel เองในโปรเจคที่เชื่อม Sheets แล้ว retry detail ซึ่งเพิ่ม sheetImport.spreadsheetId ลงใน source เดิม ต่อมานำเข้าจาก Sheets สำเร็จเป็นรุ่นใหม่และย้าย case references

ผลที่ยืนยันด้วยข้อมูลจำลอง: cleanup planner จัด local upload รุ่นเก่าเป็น eligible แม้ workbookStorage เป็น supabase ดังนั้นคำกล่าวว่าเก็บ local uploads เสมอไม่เป็นจริง การรัน apply ยังต้องมี fingerprint/approval แต่รายการอาจจัดประเภทไฟล์ผิด

ควรแก้: persist source origin ที่ชัดเจนตั้งแต่ตอนสร้าง source และไม่เปลี่ยน origin เมื่อเติม checkpoint; legacy origin ที่พิสูจน์ไม่ได้ต้องถูก hold หรืออยู่ในรายการอนุมัติแยก นี่เป็น synthetic repro ไม่ใช่ข้อสรุปว่ารอบ cleanup จริงลบไฟล์ผิด

## P2 — 4. เคสที่ยังไม่มี Ref/ผลทดสอบทำให้ซิงค์ทั้งโปรเจคล้ม

ตำแหน่ง: `src/lib/google-sheets.ts:541-547`, `src/lib/register-result-write-plan.ts:11-14`

กรณี: TC01 มี Ref=Proof และแท็บ Proof อยู่จริง ส่วน TC02 ยังไม่ทดสอบ ไม่มี Ref และไม่มีแท็บชื่อ TC02

ผลที่ยืนยันได้: safeRegister วางแผน snapshot ให้ทุกแถว แล้ว throw ว่าไม่พบ TC02 ทำให้ TC01 และทั้งโปรเจคซิงค์ไม่ได้ แม้ TC02 ไม่มีผลที่ต้องเขียน

ควรแก้: แยกการอัปเดต register ออกจากการเขียน result snapshots และจัดการเคสไม่มี Ref ตาม flow เดิม อย่าบังคับสร้าง/หา result tab สำหรับเคสที่ไม่มีผล

## P2 — 5. ซิงค์ ordinary register ที่มี Ref ข้าม Defects และ custom fields เดิม

ตำแหน่ง: `src/lib/google-sheets.ts:569`

กรณี: เคสในตารางธรรมดามี Ref และมี defect ที่บันทึกจากเว็บ แล้วกดซิงค์

ผลที่ยืนยันได้: เข้าสาขา safeRegister และ return ก่อน defectRecordsForSync; stepResultSnapshotRows serialize เฉพาะ results ดังนั้น defect-only case ได้เพียง START/END marker แต่ระบบรายงานสำเร็จและ defects=0

ผลเพิ่มเติมที่ยืนยันได้: แก้ custom field Extra จาก original เป็น edited ใน master register แล้ว buildRegisterExecutionWritePlan สร้างเฉพาะ status range D2 ไม่มี B2 ขณะที่ flow เดิมเขียน customFieldData ลงตำแหน่งเดิมด้วย สาขาใหม่นี้ return ก่อนถึงจุดเขียนนั้นเช่นกัน

ควรแก้: ให้สาขานี้ใช้การเขียน defects/evidence และ custom fields ที่เทียบเท่า flow เดิม พร้อมทดสอบ round trip

## P2 — 6. Detail import บันทึก source ชั่วคราวโดยไม่ผูก revision

ตำแหน่ง: `src/components/qa-workspace.tsx:1610-1612` และ2171-2173

กรณี: เปิดรายละเอียดที่ยังไม่เคยโหลดในโปรเจค legacy ซึ่ง checkpoint เดิมไม่มี sourceRevision แล้ว branch สร้าง google-sheets source ใหม่จาก workbook ที่ parse

ผล: metadata ไม่มี revision และไม่เก็บ bytes ใน Storage หลัง reload การ hydrate/Export ใช้ sourceId แล้วถูก workbook endpoint ปฏิเสธเพราะ revision ว่าง จนกว่าจะนำเข้าทั้งโปรเจคใหม่ Viewer ไม่สามารถเริ่ม import เพื่อแก้เองได้

ควรแก้: ทุกจุดที่สร้าง transient source ต้อง capture และตรวจ revision ให้ตรงกับ bytes ก่อน persist ไม่ใช่เฉพาะ full import

## P2 — 7. Gmail timeout ทำให้กดส่ง PO ซ้ำได้ทันที

ตำแหน่ง: `src/lib/approval-email.ts:55-56`

กรณี: Gmail รับเมลไปแล้ว แต่ response ขาดหาย/timeout

ผลที่ยืนยันด้วย send mock ที่ throw ETIMEDOUT: บันทึก gmail-failed แล้ว approvalSendBlocked=false จึงส่งอีเมลซ้ำได้ทันที ต่างจาก Microsoft ที่เก็บสถานะ unknown สำหรับกรณีไม่แน่ใจ

ควรแก้: แยก definitive rejection จาก network/transport uncertainty และใช้ unknown/guard เดียวกับ Microsoft พร้อมตรวจ Sent ก่อน retry

## P2 — 8. โปรเจค 2,001 เคสนำเข้าเสร็จไม่ได้

ตำแหน่ง: `src/lib/sheet-refresh.ts:9`, การส่ง final checkpoint ที่ `src/components/qa-workspace.tsx:2047`

กรณี: register มี2,001เคส ระบบอ่านและบันทึกเคสได้ แต่ registerBaseline สร้าง baseline ทั้งหมด ขณะที่ isRegisterBaseline จำกัด2,000และ import-state validation ปฏิเสธ

ผลที่ยืนยันด้วย helper: case count2001, baseline accepted=false ส่วน readSheetImportState จะทิ้ง checkpoint ที่มี baseline เกินขนาดด้วย

ควรแก้: รองรับขนาดนี้หรือแจ้งข้อจำกัดก่อนเริ่มเขียนข้อมูล ห้ามจบด้วย partial import ที่ไม่อาจ complete ได้ เพิ่ม boundary tests2,000/2,001

## สิ่งที่ต้องจัดชุดก่อน stage

พบโฟลเดอร์ `QAResultTestcase/` เป็น Git repository ซ้อน มี branch main แต่ยังไม่มี HEAD commit/ไฟล์ tracked อย่านำเข้า commit หลักโดยไม่ตั้งใจ ให้แยกโฟลเดอร์นี้ออกจากชุดที่ stage (การรีวิวไม่ได้ลบหรือแก้ repository นี้)

## Verification

- Full suite:606passed,0failed
- Full-project ESLint:pass
- Production Next build:pass
- Workspace navigation cache regression:pass
- Read-only workspace regression:pass
- git diff --check:pass
- สแกนรูปแบบ secret/token ใน205ไฟล์ข้อความที่เปลี่ยน/เพิ่ม:ไม่พบตำแหน่งเข้าข่ายตามรูปแบบที่ตรวจ ไม่ใช่การรับประกันแทน security audit
- Repros แยกยืนยัน identity swap, Ref collision, mixed Ref/no-Ref sync, missing defect snapshot, local-upload cleanup eligibility และ baseline2,001
- Independent reviewer ยืนยัน Gmail ETIMEDOUT→gmail-failed→immediate resend unblocked โดยไม่เรียก Gmail จริง

หมายเหตุของรีวิวเดิม: ชุดทดสอบ 606 รายการยังไม่ครอบคลุม scenarios ด้านบน; เพิ่ม regression tests ในรอบแก้ด้านล่างแล้ว


## การแก้หลังรีวิว

- Identity: จองเจ้าของ definition ที่ไม่ซ้ำก่อน ใช้ Ref แยก definition ซ้ำ และจับคู่หนึ่งต่อหนึ่ง ครอบคลุม reorder, เปลี่ยน Ref, rename และ Ref ที่ชื่อใกล้กัน
- Ref: ชื่อแท็บ exact มาก่อน และปฏิเสธ normalized fallback ที่กำกวม
- Source origin: บันทึก upload/google-sheets ตอนสร้าง source; cleanup ถือไฟล์ upload และ legacy ที่ไม่ทราบ origin ไว้ แม้มี checkpoint Sheets
- Safe sync: ไม่บังคับหาแท็บให้เคสไม่มี Ref/ผลทดสอบ; แยกปลายทางของเคสย่อยได้ และคง Defects, evidence, custom fields รวม Test data และสูตรเดิม
- Snapshot: ผลทดสอบและ case metadata มี roundtrip ผ่าน Sheets และ Excel; ตรวจเพิ่มการอ่านหลังสลับแถว definition ซ้ำ
- Partial import: capture revision ก่อนอ่านรายละเอียด ตรวจ workbook ที่ดาวน์โหลดกับ revision เดียวกัน และบันทึก revision ใน source metadata ทั้ง detail/retry; ไฟล์ upload/unknown ไม่ใช้แทน cache ของ Sheets
- Gmail: timeout/transport/5xx เป็น unknown พร้อม cooldown และข้อความให้ตรวจ Sent ก่อนส่งซ้ำ; definitive 4xx เป็น failed
- Baseline: ถอดเพดาน 2,000 รายการ พร้อมตรวจทุกแถวและทดสอบ 2,000/2,001/10,000 รายการ
- Parent Git: เพิ่ม /QAResultTestcase/ ใน .gitignore โดยคงโฟลเดอร์และ Git ซ้อนเดิมไว้

การตรวจใช้ fixtures/mocks; ไม่ส่งอีเมล ไม่เขียน Sheets ไม่ลบ Storage และไม่ push ในรอบแก้นี้


การตรวจ ownership รอบสุดท้ายยืนยันแก้ทั้ง Ref สลับระหว่าง definition ต่างกัน และ snapshot เก่าในแท็บที่เคยมีหลายเจ้าของแล้ว กรณี legacy ที่พิสูจน์เจ้าของไม่ได้จะไม่ย้ายผลให้เคสอื่น

ผลตรวจหลังรวมการแก้: full suite **647 passed / 0 failed**; focused independent ownership review 50 passed และไม่พบ actionable finding ใหม่ ผล Full-project ESLint และ production Next build (รวม TypeScript) **ผ่าน**; navigation-cache / read-only-workspace checks และ git diff --check ผ่าน

ไม่มีการ commit หรือ push ในรอบนี้ และไม่ทดสอบด้วยการส่งอีเมล/แก้ Sheets/ลบ Storage จริง
