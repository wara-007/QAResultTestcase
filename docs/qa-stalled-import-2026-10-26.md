# Pay ban cancel — สถานะนำเข้าค้างหลังเปิด CAN_01_TC01

โปรเจค: 4b93c6ff-65b4-4f6a-b940-96db3e63889a

## หลักฐานที่ตรวจ

- ผู้ใช้ยืนยันว่าหมายถึงข้อความสถานะด้านบน ไม่ใช่เนื้อหาในเคสหาย
- CAN_01_TC01 มี Ref/target = CAN_01_TC01; ผลที่เก็บอยู่มีรูป 3 รูป ไม่มี import issue
- Source รุ่น 15 มี manifest 239 รายการ; UI ตรวจพบรูปบันทึกแล้ว 239/239 แต่ states โหลดครบเพียง 4/23 แท็บ และ complete=false
- Source รุ่น 14 ใน revision เดียวกันยังมี 20 แท็บ queued; รุ่น 15 เพิ่มสถานะเคสที่เปิดดู แต่ไม่ได้จบ import ทั้งโปรเจค
- ไม่มีข้อมูลพอระบุเหตุที่รอบก่อนหยุด แต่ยืนยันเหตุที่ค้างต่อไปได้จากโค้ด: startAutomaticImport เรียก full import เฉพาะเมื่อ sheetRefreshRequired=true จึงไม่ทำต่อเมื่อ revision เดิมและ complete=false
- UI เดิมวาด progress 100% จากจำนวนรูปอย่างเดียว ทั้งที่ข้อมูลแท็บยังตรวจไม่ครบ

## การแก้

- automaticSheetImportMode แยก fresh / resume / no work: revision เปลี่ยนให้อ่านใหม่, revision เดิมที่ยังไม่ complete ให้ทำส่วนที่เหลือต่อ, complete แล้วไม่ทำซ้ำ
- ยังคงใช้ guard เดิมสำหรับสิทธิ์แก้ไขและ import ที่กำลังทำงานในหน้าเดียวกัน
- แสดงจำนวนแท็บที่เหลือเมื่อรูปครบแต่ข้อมูลยังไม่ครบ และซ่อนแถบรูป 100% ในสถานะนั้น
- ไม่แก้สถานะในฐานข้อมูลให้ complete โดยข้ามการตรวจจริง

## การทดสอบ

- Regression red → green: matching revision + incomplete ต้อง resume; matching revision + complete ไม่ทำซ้ำ; changed/invalidated revision ต้อง fresh
- UI regression 239/239 รูป + 4/23 แท็บ แสดงเหลือข้อมูลอีก 19 แท็บ และไม่แสดงแถบเต็ม
- Full tests: 649 passed, 0 failed
- TypeScript, ESLint เฉพาะไฟล์ที่แก้ และ git diff --check ผ่าน
- เปิดหน้าโปรเจคจริงพบว่าระบบเริ่มอ่านและบันทึกรายละเอียดที่ค้างต่ออัตโนมัติ และจบด้วย “บันทึกหลักฐานครบแล้ว”, 23/23 แท็บ, 239/239 รูป; ไม่พบข้อความเตือนเดิมในหน้าโปรเจคหลังจบ
- API final revision และบันทึก import-state ตอบ 200; ไม่มีการแก้สถานะให้ครบด้วยมือ
- หลักฐานภาพ: /tmp/qa-import-complete-2026-10-26.png
- Navigation-cache และ read-only-workspace regression scripts ผ่าน
