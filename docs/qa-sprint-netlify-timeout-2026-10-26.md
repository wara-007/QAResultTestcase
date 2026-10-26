# Sprint 68 — เปิดหน้า Dashboard บน Netlify ไม่สำเร็จ

Route: /groups/b5451207-986a-4ca6-88c0-8eda1e8d3972/years/2026/sprints/12fd29e3-6aed-40e4-97e4-c0a5b7a56820
Base commit: 45f6226

## หลักฐาน

- หน้า production ขึ้น “This page couldn’t load”; Netlify SSR function log มีหลาย invocation หยุดที่ Duration: 30000 ms ในช่วงเกิดปัญหา
- Local route เปิดได้ช้า: 43 วินาที ก่อนแก้
- Development timing ที่เพิ่มชั่วคราวยืนยันว่าอ่าน case pages 0,10,20,…,120 ต่อกัน ใช้ประมาณ 39 วินาที ก่อนโหลด participation/snapshot ส่วนที่เหลือ; นำ timing instrumentation ออกหลังวิเคราะห์แล้ว
- การเพิ่ม concurrent reads อย่างเดียวไม่เพียงพอ: พบ personal_sprint_cases timeout และบางรอบยังใช้เวลานาน จึงตัดการคำนวณ metadata จาก payload เดิมซ้ำในฐานข้อมูลออกด้วย

## การแก้สุดท้าย

- อ่านหน้าขนาดเล็กครั้งละไม่เกิน 4 คำขอ รักษาลำดับและครบทุกช่วง ไม่รายงานยอดบางส่วนเมื่อหน้าที่จำเป็นล้มเหลว
- เมื่อ PostgreSQL timeout ให้แบ่งเฉพาะช่วงที่ล้มเหลวเป็นช่วงย่อยจนเหลือหนึ่งแถว; ไม่ข้าม offset
- สร้าง personal metadata จาก case execution payload ที่โหลดมาเพื่อสรุปเคส/defects อยู่แล้ว แทน personal_sprint_cases RPC ที่ parse ผลทดสอบ/log ซ้ำ
- รักษาลำดับผู้ทดสอบ: custom field แรก → testerName ที่บันทึก (รวมชื่อว่าง) → ผู้เขียนที่ยืนยันจาก active origins → register fallback
- อ่าน assignees ผ่าน RLS; อ่านเพิ่มเฉพาะ case IDs ของงานที่ย้ายออกแต่มี active origin ใน Sprint นี้ เพื่อไม่ทำผลงานย้อนหลังหาย
- ข้อมูลที่ส่งไป Dashboard ไม่รวม API body/log/evidence ก้อนใหญ่
- เพิ่ม loading.tsx เพื่อให้คลิกแล้วเห็น “กำลังโหลดภาพรวม Sprint” ทันที
- ไม่เปลี่ยน schema, สิทธิ์, ข้อมูลเคส หรือ deployment

## Verification

- Live local normal reload หลังแก้: HTTP200 ใน 24.1 วินาที; แสดง 112 เคส, Pass95, Skip17, 4Projects ตรงกับ baseline
- ระยะเวลายังขึ้นกับฐานข้อมูล/เครือข่าย; ไม่รับประกันเวลา production จากผล local และยังไม่ได้ deploy ชุดแก้นี้
- Screenshot: /tmp/qa-sprint-open-2026-10-26.png
- Full suite: 658 passed, 0 failed
- Full-project ESLint: passed
- Production Next build (รวม TypeScript): passed
- Navigation-cache / read-only regression scripts / git diff --check: passed
- Independent review: ไม่พบ blocker หลังแก้ parity ของ custom tester field แรกที่ว่าง; 21 focused tests ผ่าน
- โค้ดยังเป็น working-tree changes เทียบกับ45f6226; ต้อง push/deploy ก่อนตรวจยืนยันบนเว็บจริง
