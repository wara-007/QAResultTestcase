# React #412 เมื่อเปิด Sprint — ตัดงานอ่านข้อมูลออกจาก SSR

Base commit: 121ae21 (Netlify เผยแพร่แล้วขณะตรวจ)
Affected route: /groups/0eb8b839-1dfe-48c5-8cb9-514062ed12a7/years/2026/sprints/82cb2e99-dc82-4c82-93a1-037b9618b920

## สาเหตุและหลักฐาน

- React error code 412 คือ “Connection closed.” ตาม source ของ React: https://github.com/facebook/react/blob/main/scripts/error-codes/codes.json
- Production แสดง “This page couldn’t load” หลังเผยแพร่121ae21แล้ว จึงไม่ใช่แค่ใช้ deploy เก่า
- การลดเวลาอ่านข้อมูลรอบก่อนยังปล่อยให้ SSR รอ dashboard ทั้งชุด จึงยังเสี่ยง stream ถูกตัดเมื่อข้อมูล/เครือข่ายช้า
- ระหว่างทดสอบพบ PostgreSQL statement timeout ในการอ่านหลายชุดพร้อมกันด้วย จึงต้องลดภาระฐานข้อมูล ไม่ใช่เพิ่ม parallelism อย่างเดียว

## การแก้

- Server page ตรวจปี/Sprint และโหลด catalog/สิทธิ์พื้นฐาน แล้วส่ง SprintDashboardLoader กลับทันที ไม่รอ execution/log payloads ทั้ง Sprint
- ย้าย read repository เป็น shared functions ที่รับ authenticated SupabaseClient; browser ใช้ public client/session เดิมและ RLS เดิม ไม่มี service secret หรือ server-only dependency ใน client graph
- อ่านผลทดสอบทีละชุดเล็ก10แถว และแบ่งช่วงย่อยเมื่อ PostgreSQL timeout จนถึงหนึ่งแถว; ไม่เผยแพร่ยอดบางส่วนว่าเป็นยอดครบ
- แสดงจำนวนแถวที่อ่านได้และช่วงสรุปข้อมูลระหว่างรอ; เมื่อพลาดให้แสดง error จริงและ Retry แทนหน้าขาว/ยอดศูนย์ปลอม
- ป้องกัน pending query ซ้ำจาก Strict Effects; unmount ไม่อัปเดต state และ route key แยกตาม group/Sprint/user
- รักษา metadata, origins, assignees, moved-out performance และ snapshots ตาม logic เดิม; server wrappers ยังคงใช้ reader เดียวกัน
- ข้อผิดพลาดระหว่าง refresh แสดงได้แม้เคยโหลดสำเร็จ และ Retry ล้างผลเก่าก่อนเริ่มใหม่
- ไม่มีการเปลี่ยน schema หรือสิทธิ์ และไม่ได้ deploy รอบแก้นี้

## Verification

- Regression SSR route: old code fail เพราะเรียก heavy dashboard loader; new code ส่ง interactive loader โดยไม่เรียก heavy SSR load
- Full tests: 659 passed, 0 failed
- Full-project ESLint: passed
- Production build (รวม TypeScript): passed
- Navigation-cache/read-only regression scripts และ git diff --check: passed
- Independent review ไม่พบ blocker หลังแก้ refresh-error precedence และลด payload concurrency เป็น1
- Live local affected Sprint: initial server response ราว0.6–2.2วินาทีในการตรวจ; อ่านต่อจนครบ81เคส, Pass71/Failed1/Skip8/NotStart1, 4Projects
- Final screenshot: /tmp/qa-sprint-stream-complete-2026-10-26.png
- การทดสอบพบ timeout ในรอบอ่านพร้อมกัน4คำขอ จึงเปลี่ยนเป็นอ่านทีละชุดและยืนยันใหม่จนสำเร็จ ไม่สรุปจากการเปิดหน้าเพียงรอบแรก
- งานอ่านข้อมูลอาจยังใช้เวลาตามขนาดข้อมูลและความพร้อมของ Supabase แต่ไม่อยู่ในคำขอ SSR ยาวที่เปิดหน้าอีกต่อไป
- ต้อง push/deploy ชุดแก้นี้ก่อนตรวจยืนยัน production อีกครั้ง; ยังไม่อ้างว่า production หายแล้ว
