# QA Workspace — ตรวจ Flow วันที่ 23 ตุลาคม 2026

ตรวจบน `http://localhost:3002` ด้วย Chrome ที่เข้าสู่ระบบแล้ว และตรวจโค้ด/ชุดทดสอบของระบบประกอบกัน ขอบเขตครอบคลุมเส้นทางหลักของแอป โดยใช้กลุ่ม Package, Sprint 68, Release App 11.1002 และ Web Handle Error 404 เป็นตัวอย่าง การตรวจนี้ไม่ได้ยืนยันว่าทุกแถวของทุก Project ถูกตรวจด้วยสายตา หรือทุกการเขียนข้อมูลถูกทดลองกับฐานข้อมูลจริง

## ผลตรวจตามลำดับการใช้งาน

| ลำดับ | Flow | สิ่งที่ตรวจจริง | ผลและข้อจำกัด |
|---|---|---|---|
| 1 | เลือกปี → Groups | เลือกปี 2026, แสดง 11 กลุ่ม, เปิด Package | เปิดได้และส่งปีต่อไปยัง Sprint ได้ |
| 2 | Sprints → Sprint Dashboard | Sprint 67/68, ยอดรวมและรายบุคคล, drill-down Pass 24, เปลี่ยนหน้ารายการ 1/3 → 2/3 | ตัวอย่าง Sprint 68 แสดง 7 Projects, 102 เคสที่บันทึกไว้, Pass 32, Not Start 70; แก้การนับแท็บผลที่ไม่ใช่ทะเบียนเคส |
| 3 | Projects → ค้นหา/เลือก Project | รายการ 7 Projects, ค้นหา Release เหลือ 1/7, สลับไป Web Handle Error 404 | เปิดถูก Project; ค้นหาจากรายละเอียดได้ด้วยหลังแก้ |
| 4 | Overview → Test cases | Release 34 เคส, Pass 32, Not Start 2; กรอง Not Start เหลือ 2; อีก Project 12 เคส | ตัวเลขสอดคล้องกับชุดที่บันทึกไว้; ต้องแยกจากต้นฉบับ Google Sheets ที่ใหม่กว่า ดูข้อค้างด้านล่าง |
| 5 | Test case → Steps → Result Testing | TC_01 เปิดได้, Step1/Step2 มีผลคนละ 1; ผลอยู่ภายใน Step; Preview อีก Project มี 3 Steps | แก้การค้างจากตัวแสดงโค้ดจำนวนมาก; DOM ของ TC_01 เหลือ CodeMirror 2 ตัว ไม่มี horizontal overflow ที่ viewport 1512px |
| 6 | Defects | หน้าไม่มี Defect ของ Release, การเก็บข้อมูล Defect เมื่อ save/parse ผ่านชุดทดสอบ | หน้า empty state เปิดได้; ยังไม่ได้สร้าง/ลบ Defect จริง; ข้อมูล platform/reporter/reference ไม่หายเมื่อเปิดใหม่หลังแก้ |
| 7 | เอกสาร/ไฟล์ → ส่งออก | รายการไฟล์ 40 แท็บ, ปุ่มนำเข้า/ซิงค์/ดาวน์โหลดตามสิทธิ์, กดดาวน์โหลด Result แล้วปุ่มกลับพร้อมใช้งาน | ตรวจการเริ่มสร้างไฟล์จาก UI; ไม่ได้เปิดไฟล์ดาวน์โหลดรอบนี้เพื่อตรวจทุกเซลล์; exporter มี regression tests; ไม่ได้ push กลับ Google Sheets |
| 8 | Settings → QA → ประวัติ | เปิด Settings ของสอง Project, ชื่อ/Environment/ปี/Sprint และประวัติถูก Project | เพิ่ม key แยก state ฟอร์มตาม Project; ไม่ได้ save หรือย้าย Sprint จริง; ประวัติแบบ frozen snapshot ตรวจด้วยชุดทดสอบ |
| 9 | QA Approval → PO inbox → Review | ร่างอีเมล, inbox 4 คำขอ, เปิดคำขอเดิมและรายการผล/การแบ่งหน้า | แก้ร่างอีเมลค้าง 0 เคสทั้งที่มี 12; ไม่ได้ส่งเมลหรือกดอนุมัติ/ขอแก้ไขจริง |
| 10 | สมาชิกกลุ่ม → ผู้ดูแล → Auth | เปิดสมาชิก Package และ System Users, หน้าขอรีเซ็ตรหัสผ่าน, โค้ด redirect/สิทธิ์ | แบบฟอร์มแสดงได้; ไม่เพิ่ม/ถอนสิทธิ์ ไม่ส่งอีเมล reset ไม่เปลี่ยนรหัสผ่าน; session หลายบทบาทตรวจด้วย tests ไม่ใช่ login ใหม่ทุกบทบาท |

## ปัญหาที่แก้

1. **TC_01 ค้าง:** รวมแถว JSON ที่ต่อกันเป็น block เดียวแทนการสร้าง editor ต่อเซลล์ คง highlight, link และขอบเขตข้อมูลเดิมไว้
2. **ผลทดสอบไม่อยู่ใน Step:** ใช้ heading Step ที่จับคู่ได้เพียงหนึ่ง Step, แสดง Result Testing ใน Step ที่เป็นเจ้าของ, รักษาการจับคู่ที่ QA แก้เอง และไม่เดาจาก heading เมื่อคำอธิบายขัดกัน
3. **ขอบเขตรูปท้ายแท็บ:** รวมขอบเขตรูปที่ยื่นพ้นแถวข้อความ พร้อมซ่อมการผูกภาพเดิมจาก anchor โดยรักษาข้อความที่ QA แก้เอง
4. **Defect สูญเสียรายละเอียดเมื่อเปิดใหม่:** normalize โดยรักษาฟิลด์จากทะเบียนเดิมก่อนเติมค่า default
5. **Project มีเคสมากกว่า REST response cap:** โหลดครบทุกหน้าด้วยลำดับที่แน่นอน; regression ใช้ 1,201 เคส
6. **Sprint นับ sheet-only snapshot เป็นเคส:** รักษา result_reference เพื่อจำแนกทะเบียนจริง; pending approval ยังถูกนับแม้ Project มีคำขอให้แก้ไขพร้อมกัน
7. **ค้นหา Project จากคำอธิบายไม่เจอ:** ส่ง description ของ Project ปัจจุบันมาถึงตัวกรอง Sprint
8. **รูปใหม่ถูกทิ้งเมื่อมีรูปเดิม:** รวม evidence ใหม่ด้วย fileId โดยรักษา attachments เดิม
9. **รูป Drive อาจถูกปฏิเสธสิทธิ์ผิด:** อ่าน candidate ครบทุกหน้าและตรวจ fileId ใน evidence จริง โดยยังตรวจ RLS/สิทธิ์ Project ทุกครั้ง
10. **ปี/Sprint แสดงสาเหตุผิด:** ส่งข้อผิดพลาดจริงของฐานข้อมูล/เครือข่ายกลับให้หน้า UI และจับ rejection แทนการบอกให้รัน migrations สำหรับทุกกรณี
11. **ร่าง Approval มีจำนวนเคสเก่า:** สร้าง template จากค่าปัจจุบันตราบใดที่ผู้ใช้ยังไม่แก้ข้อความ; เก็บข้อความที่แก้เองรวมถึงข้อความว่างไว้
12. **Environment กลายเป็น Please Select:** ค่าจาก dropdown ที่เป็น prompt ไม่ถูกนำมาแทน Environment ของ Project ใน header/Approval
13. **จำนวนเคสเปลี่ยนเมื่ออ่านรายละเอียด:** จำกัด lazy detail refresh ให้อัปเดตทะเบียนที่บันทึกไว้และ sheet snapshot; เคสทะเบียนใหม่เข้าผ่าน explicit import แทน จึงไม่เกิดยอด 34 → 46 เฉพาะหน้าที่อ่าน
14. **การทดสอบสิทธิ์ viewer ล้าสมัย:** ตรวจ ProjectFileActions ที่แยกเป็น component จริง ทั้ง Project ที่เชื่อม/ไม่เชื่อม Google Sheets
15. **ผลใหม่อาจถูก lazy detail refresh ทับ:** ขณะอ่านรายละเอียดจาก Sheets ให้ drawer อ่านอย่างเดียวชั่วคราว และป้องกัน save ที่ชั้น handler จน refresh เสร็จ; งานที่ยกเลิกหลังเปลี่ยนหน้าหยุดก่อนเขียน และงานเขียนที่เริ่มแล้วรักษา lock ข้าม route จนเสร็จ
16. **กลับจากเชื่อมเมลแล้วร่างไม่ตามข้อมูลใหม่:** เก็บสถานะร่างอัตโนมัติเป็น null ข้าม OAuth และเก็บข้อความที่แก้เองเป็น string

ไฟล์หลัก: `src/components/qa-workspace.tsx`, `src/lib/sheet-sections.ts`, `src/lib/step-sheet-results.ts`, `src/lib/workbook-step-refresh.ts`, `src/lib/sheet-register-cases.ts`, `src/lib/project-data.ts`, `src/lib/planning-server.ts`, `src/lib/stored-results.ts`, `src/lib/sync/workspace-merge.ts`, `src/lib/shared-drive-evidence.ts`, `src/lib/approval-draft.ts`, `src/lib/workspace-environment.ts`

## ข้อมูล/Flow ที่ยังต้องตรวจต่อกับข้อมูลจริง

- **ต้นฉบับกับข้อมูลบันทึกไม่เท่ากัน:** วันที่ตรวจ Google Sheets แท็บ Testcase ช่วง A1:F150 มี TC_01–TC_40 และ MRS 6 เคส รวม 46 เคส แต่ชุด Release ในระบบที่บันทึกไว้มี 34 เคส ส่วนต่าง 12 เคสต้องผ่านการนำเข้า/เทียบ conflict ให้ครบก่อนยืนยันว่าเว็บสะท้อนต้นฉบับล่าสุดทั้งหมด การแก้ lazy refresh ทำให้ยอดไม่เปลี่ยนลอย ๆ ระหว่างอ่าน แต่ไม่ได้อ้างว่าได้นำเข้าส่วนต่างครบแล้ว
- **สถานะนำเข้า Release ยังไม่ครบ:** หน้าเว็บแสดงโหลดแล้ว 2/40 แท็บ แม้มีไฟล์ต้นฉบับและ metadata ของรูป 54 รูป การเห็นจำนวนรูปใน metadata ไม่ได้ยืนยันว่าทุกรูปโหลดและผูก Step สำเร็จ ต้องตรวจการนำเข้าและภาพจริงให้ครบ
- **Approval เก่ามีรายการ metadata:** คำขอเดิมชื่อ test แสดง Summary/Data Test/RC Defect เป็นรายการใน snapshot ด้วย ไม่ควรตีความยอด 50 ของ snapshot นี้ว่าเป็นทะเบียนเคสปัจจุบัน ยังไม่ได้แก้ snapshot ที่เคยอนุมัติไปแล้ว
- **เครือข่ายไม่เสถียรเป็นช่วง:** พบ fetch failed เมื่อโหลด Projects/Defects; reload กลับมาเปิดได้ อีกครั้ง dev server หยุดแล้วเปิดใหม่ได้ ยังไม่มีหลักฐานเพียงพอชี้ว่าเป็นบั๊กแอปหรือเครือข่ายภายนอกทั้งหมด
- **การเขียนจริง:** การสร้าง/แก้/ลบเคส, upload รูป, push Sheets, ย้าย Sprint, เปลี่ยนสิทธิ์, ส่งเมลและอนุมัติ ใช้ tests/code review ประกอบ แต่ไม่ได้ทำ live transaction ทุกเส้นทางกับข้อมูลผู้ใช้
- **Auth/มือถือ/Accessibility:** ยังไม่ได้ทำ OAuth ใหม่ทุกบทบาท, password reset จนจบ, ทดสอบอุปกรณ์มือถือ, keyboard-only และ screen reader ครบทั้งระบบ ภาพ desktop อย่างเดียวใช้รับรองส่วนเหล่านี้ไม่ได้
- **ข้อสังเกต UX:** ปุ่มไอคอน More ใน Overview ไม่มี accessible name และไม่มี action ที่เห็นในโค้ด; หน้า loading บางช่วงแสดงยอด 0 ก่อนข้อมูลมาพร้อมข้อความกำลังโหลด; มี Next warning เรื่อง smooth scroll attribute ทั้งหมดนี้ยังไม่ใช่หลักฐานว่าข้อมูลบันทึกสูญหาย

## หลักฐานการตรวจอัตโนมัติ

ใช้ Node 24.22.1 ตาม runtime ที่รองรับ (package ต้องการ Node >=22):

```sh
node --import tsx --test src/lib/*.test.ts src/lib/sync/*.test.ts src/components/*.test.ts
node --import tsx scripts/verify-read-only-workspace.ts
node --import tsx scripts/verify-workspace-navigation-cache.ts
node node_modules/eslint/bin/eslint.js .
node node_modules/next/dist/bin/next build
```

ผลรอบสุดท้าย: 434 tests ผ่าน, 0 fail; read-only/cache checks ผ่าน; ESLint ผ่าน; production build และ TypeScript ผ่าน ไม่ได้ deploy หรือ commit ในงานนี้

## ภาพตาม Flow

ภาพเก็บในเครื่องผู้ใช้ ไม่มีการเผยแพร่ภายนอก:

1. ปี → Groups → Sprints

![เลือกปี](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/01-years.png)
![Groups](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/02-groups.png)
![Sprints](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/03-sprints.png)

2. Dashboard → รายบุคคล → Projects

![Sprint Dashboard](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/04-sprint-dashboard.png)
![Drilldown](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/05-personal-drilldown.png)
![Projects](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/06-projects.png)

3. เคส → Overview → ผลใน Step

![ตัวกรองเคส](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/07-case-filter.png)
![Overview](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/08-overview.png)
![Result อยู่ใน Step1](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/15-tc01-step-result.png)
![Preview อีก Project](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/14-preview-other-project.png)

4. Defects → Files → Settings

![Defects](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/09-defects.png)
![Files](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/10-files.png)
![Settings](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/11-settings.png)
![Settings อีก Project](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/13-settings-other-project.png)

5. ร่าง Approval → Inbox → Review

![ร่างตรงกับจำนวนเคส](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/12-approval-counts-fixed.png)
![Inbox](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/16-approval-inbox.png)
![Review](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/17-approval-review.png)

6. สมาชิก → ผู้ดูแล → ขอรหัสผ่าน

![สมาชิก](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/18-group-members.png)
![ผู้ดูแล](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/19-admin-users.png)
![ขอรหัสผ่าน](/Users/wara/.codex/visualizations/2026/10/23/01a167f5-5ca2-7750-959c-c1cf163e2572/flow-audit/20-forgot-password.png)
