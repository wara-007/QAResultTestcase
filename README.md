# QA Result Workspace

MVP สำหรับนำเข้า Testcase จาก Excel, บันทึกผลการทดสอบ และส่งออกผลกลับลงสำเนา workbook เดิม

## ความสามารถในเวอร์ชันนี้

### Sprint Defects และการลบ Group/Project

รัน `supabase/migrations/20261002034634_sprint_defect_totals.sql` หลัง migrations ปี/Sprint และ Dashboard เดิม (รองรับรันซ้ำ)

- Dashboard แสดง Defects ปิดแล้ว/ทั้งหมด เช่น 5/10 โดย Closed, Resolved, Pass, Passed นับเป็นปิดแล้ว ใช้ attempt ล่าสุดของแต่ละเคส
- เมนูจัดการ Project เป็น native popover อยู่ชั้นบน ไม่ขยายแถวหรือโดนตารางตัด
- Group Owner และ System Owner ลบ Group ได้ รวมทุก Project ภายใน แม้สร้างโดยสมาชิกคนอื่น; ลบ Project เดี่ยวได้เฉพาะผู้สร้างหรือ System Owner ตามเดิม
- ลบผ่าน Server Actions เท่านั้น ปิด DELETE ผ่าน Data API เพื่อไม่ให้ข้ามขั้นตอนเก็บกวาดหลักฐาน
- ลบไฟล์ R2 ตาม prefix ของ Project และย้ายรูป/วิดีโอที่ระบบอัปโหลดใน Google Drive ไปถังขยะ ไม่ลบ Google Sheets, รูปต้นฉบับนำเข้า หรือโฟลเดอร์ทั้งก้อน
- Drive uploads ใหม่ติด project/uploader metadata; รูปเก่าตรวจชื่อไฟล์และโครงสร้างโฟลเดอร์ก่อนลบ ถ้ายืนยันไม่ได้หรือสิทธิ์ Google ใช้งานไม่ได้ จะลบ Group/Project ต่อได้ พร้อมคำเตือนว่ารูปใน Google อาจยังอยู่และต้องลบเองภายหลัง ไม่กระทบ Google Sheets
- การลบหลาย Project ไม่ใช่ transaction เดียวกับ Google/R2: หากผิดพลาดกลางทาง จะแจ้งจำนวน Project ที่ลบไปแล้ว Group ยังอยู่และลองต่อได้ ไฟล์ที่ย้ายไปถังขยะแล้วจะไม่ลบซ้ำ
- ไม่ได้ทดลองลบข้อมูลจริงในการตรวจงาน ต้องตรวจด้วย Project ที่ผู้ใช้อนุญาตให้ทดสอบลบก่อนใช้งานจริง

- Dashboard และรายการ Testcase พร้อมค้นหา/กรองสถานะ
- หน้า Projects โหลดรายการที่ผู้ใช้มีสิทธิ์เห็นจาก Supabase และเพิ่ม Project ใหม่ได้
- Login ด้วย Supabase Email + Password และแยกหน้า QA/PO ตามสิทธิ์
- เปิดรายละเอียดและแก้ Result, Device, Build, Test data และ Remark
- อ่าน `.xlsx` ใน browser โดยค้นหาชีต `Testcase` และ header mapping อัตโนมัติ
- ส่งออก `_result.xlsx` ด้วยการแก้เฉพาะ XML ของชีต Testcase เพื่อรักษาชีต รูป สูตร และ formatting ส่วนอื่น
- Supabase schema พร้อม RLS สำหรับ Project, Testcase, Execution, Evidence, Defect และ Audit log
- หน้าเริ่มต้นไม่มีข้อมูลจำลอง และแสดงเฉพาะ Testcase จากไฟล์ที่อัปโหลด

## เริ่มใช้งาน

ต้องใช้ Node.js 22 ขึ้นไป

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

เปิด `http://localhost:3000` จากนั้น Login เพิ่ม/เลือก Project แล้วกด **อัปโหลด Testcase**

ทดสอบ import/export กับ workbook จริง:

```bash
npm run test:excel -- /absolute/path/to/source.xlsx
```

## เชื่อม Supabase

1. สร้าง Supabase project
2. ใส่ Project URL และ Publishable key ใน `.env.local`
3. รัน migration ใน `supabase/migrations`
4. เปิด Email provider ใน **Authentication > Sign In / Providers**
5. เพิ่ม `/auth/callback` ของ localhost และ production ใน **Authentication > URL Configuration**

System Owner เพิ่มอีเมลและ role ที่หน้า `/admin/users` จากนั้นผู้ใช้เลือก Login ด้วย Google ครั้งแรกเพื่อยืนยันอีเมลและตั้งรหัสผ่าน หรือเปิด invitation ที่ได้รับ ผู้ใช้ที่ตั้งรหัสผ่านแล้วสามารถใช้ Email + Password ได้ตามปกติ

ห้ามใส่ `service_role` หรือ secret key ในตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_`

### Migration สำหรับสิทธิ์ดูทุก Project และ Sheet mapping

ก่อน Deploy UI เวอร์ชันนี้ ต้องรันไฟล์ต่อไปนี้ใน Supabase SQL Editor หลัง migration เก่าทั้งหมด:

```text
supabase/migrations/20260929114538_global_project_read_and_sheet_mappings.sql
```

Migration นี้ทำให้ผู้ใช้ที่อยู่ใน app allowlist มองเห็นทุก Group/Project แต่สิทธิ์แก้ไขยังอ้างอิง owner, System Owner, group member และ project member เหมือนเดิม รวมทั้งเพิ่มตาราง `project_sheet_mappings` สำหรับให้ QA ผูก Google tab กับ Test Case เอง

ตรวจผลหลังรัน migration โดยแทน `<USER_UUID>`, `<GROUP_ID>` และ `<PROJECT_UUID>` ด้วยค่าจริง แล้วรันทีละบัญชี (แต่ละ block จบด้วย `rollback` จึงไม่แก้ข้อมูล):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<USER_UUID>","role":"authenticated"}', true);

-- ผู้ใช้ที่อยู่ใน allowlist แม้ไม่ได้เป็น member ต้องเห็น Project ได้
select id, name from public.projects where id = '<PROJECT_UUID>'::uuid;

-- ดูผลสิทธิ์ทั้งหมดของ Project ใน Group
select * from public.list_project_access('<GROUP_ID>')
where project_id = '<PROJECT_UUID>'::uuid;
rollback;
```

ผลที่ต้องตรวจ:

- allowlisted non-member หรือ PO viewer: query `projects` ได้ 1 row, `can_view = true`, แต่ `can_edit = false`; การ `insert/update/delete` ตารางของ Project ต้องถูก RLS ปฏิเสธหรือกระทบ 0 rows
- QA ที่ได้รับสิทธิ์: `can_view = true` และ `can_edit = true`; บันทึก Test Case/Result และ Sheet mapping ได้
- เจ้าของ Project หรือ System Owner: `can_delete = true`
- ผู้ใช้อื่นที่ไม่ใช่เจ้าของและไม่ใช่ System Owner: `can_delete = false`

หาก UI ถูก Deploy ก่อน migration ผู้ใช้จะเห็น error ของ `list_project_access` หรือ `project_sheet_mappings` และ mapping จะยังบันทึกไม่ได้

## Deploy บน Netlify Free

1. นำ repository ขึ้น GitHub แล้วเลือก **Add new project > Import an existing project** ใน Netlify
2. Netlify จะใช้ `netlify.toml` และ Node.js 22 ให้อัตโนมัติ
3. คัดลอกชื่อตัวแปรทั้งหมดจาก `.env.example` ไปที่ **Project configuration > Environment variables** โดยใช้ค่าจริงจาก `.env.local`
4. ตั้ง `NEXT_PUBLIC_SITE_URL=https://ชื่อ-site.netlify.app` แล้วสั่ง Deploy ใหม่
5. ใน Supabase Auth > URL Configuration ตั้ง Site URL เป็นโดเมน Netlify และเพิ่ม `https://ชื่อ-site.netlify.app/auth/callback` ใน Redirect URLs
6. ใน Google OAuth Client เพิ่ม `https://ชื่อ-site.netlify.app` ใน Authorized JavaScript origins และเพิ่ม `https://ชื่อ-site.netlify.app/api/google/auth/callback` ใน Authorized redirect URIs

ห้าม commit `.env.local` หรือคัดลอก secret ลง `netlify.toml`

## Cloudflare R2 สำหรับรูปหลักฐาน

1. สร้าง R2 bucket และเปิด Public Development URL หรือผูก Custom Domain
2. สร้าง R2 API token แบบ **Object Read & Write** และจำกัดสิทธิ์เฉพาะ bucket นี้
3. ใส่ `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` และ `R2_PUBLIC_BASE_URL` ใน `.env.local` และ Environment Variables ของ hosting
4. Restart dev server หรือ Deploy ใหม่

เมื่อกำหนดค่าครบ รูปใหม่จะถูกบีบอัดก่อนอัปโหลดไป R2 และ Google Sheets จะแสดงด้วย `IMAGE()` ผ่าน Public URL ส่วนรูปเก่าใน Google Drive ยังใช้งานได้เหมือนเดิม หากยังไม่ตั้งค่า R2 ระบบจะ fallback ไปใช้ Google Drive ชั่วคราว

### วิดีโอหลักฐาน

- แนบ MP4, WebM หรือ MOV ใน Result และ Defect ได้ ไฟล์ต้นฉบับต้องไม่เกิน 25 MB
- วิดีโออัปโหลดจากเบราว์เซอร์ตรงไป R2 ด้วย URL ที่ลงนามและหมดอายุใน 10 นาที ระบบตรวจสิทธิ์ก่อนออก URL และตรวจขนาด/Content-Type ก่อนรับ Evidence กลับมา
- ตั้ง CORS ใน R2 bucket → Settings → CORS policy ด้วย `docs/r2-video-cors.json` และเพิ่ม origin หากใช้โดเมนอื่น
- วิดีโอเล่นใน Viewer และหน้า Approval; MOV เล่นได้เมื่อเบราว์เซอร์รองรับ codec ของไฟล์นั้น ใน Google Sheets จะเป็น `HYPERLINK()` เปิดวิดีโอ
- เลือกบีบอัดวิดีโอก่อนอัปโหลดได้สำหรับคลิปไม่เกิน 2 นาที บนเบราว์เซอร์ที่รองรับ MediaRecorder และ captureStream จะลดด้านยาวเหลือสูงสุด 1280 px, 24 FPS, video bitrate 1.5 Mbps และคงเสียงจากต้นฉบับ ใช้เวลาใกล้เคียงความยาวคลิป หากไม่รองรับ/แปลงไม่ได้/ไฟล์ใหญ่กว่าเดิมจะเก็บต้นฉบับ

### Sprint Dashboard, ทีม และประวัติการย้าย

หลัง migration `20261001145040_years_sprints_project_history.sql` รัน `supabase/migrations/20261002030018_sprint_dashboard_origins_and_moves.sql` ใน Supabase SQL Editor แล้ว refresh เว็บ (ระบบไม่รัน SQL ให้อัตโนมัติ)

- Dashboard แบบ row: ค้นหา Projects, กรอง QA, สถานะล่าสุดและ PO Approved/ผู้รับทั้งหมด, ผลงานทีม, งานต้องติดตาม และ Projects ที่ย้ายออก
- Sprint creator ที่ยังมีสิทธิ์วางแผน หรือ Group manager/System Owner แก้ชื่อ วันที่ เป้าหมาย สถานะได้ พร้อมประวัติ และตรวจการแก้ไขชนกัน
- Project manager เลือก QA หลายคนจากสมาชิกที่ลงทะเบียนของ Group ได้ในเมนูจัดการ Project การมอบหมายไม่เพิ่มสิทธิ์แก้ไข/ลบ และเก็บประวัติ
- ย้าย Sprint ต้องใส่เหตุผล; trigger เก็บ snapshot เคส/สถานะ/Defects/QA ณ ตอนย้ายใน transaction เดียวกับการย้าย ไม่ลบผล รูป Approval หรือ Google Sheets
- งานปัจจุบันนับตาม Sprint ปัจจุบันของ Project; ผลงานรายบุคคลนับตาม Sprint และผู้บันทึกต้นกำเนิดของ Result แม้ Project ย้ายออกไปแล้ว
- Result ต้นกำเนิดถูกกำหนดโดยฐานข้อมูล ไม่รับค่าผู้บันทึก/Sprint จาก client; แก้ไขหรือลบแล้วนำ ID เดิมกลับมายังอ้างต้นกำเนิดเดิม Results ที่ลบไม่รวมผลงานปัจจุบัน
- ข้อมูลเดิม/นำเข้าที่ไม่มีต้นกำเนิดตรวจสอบได้จะระบุ `inferred` ใช้ Sprint ที่ Project อยู่ตอนพบข้อมูล และไม่ยกผลงานให้ผู้ที่นำเข้า
- Snapshot ตอนย้ายไม่เปลี่ยนย้อนหลัง ส่วนผลงานรายบุคคลแสดง Results ที่ยังอยู่และสถานะปัจจุบันของ Result นั้น; ไม่ใช่ snapshot ปิด Sprint
- Dashboard อ่านเฉพาะสรุปและ metadata ที่บันทึกไว้ในฐานข้อมูล ไม่โหลด API response, log, รูปหรือ Google Sheets ไปที่ browser; นำเข้าหรือบันทึกผลก่อนเพื่อให้ Dashboard มีข้อมูลล่าสุด
- เมนูทีม/ประวัติอยู่ใน query `?view=team` / `?view=history` รีเฟรชแล้วยังอยู่เมนูเดิม

### ปี → Sprint → Projects และประวัติ

รัน `supabase/migrations/20261001145040_years_sprints_project_history.sql` ใน SQL Editor หลัง migrations เดิม แล้ว refresh เว็บ ไฟล์นี้สร้างปี/Sprint, backfill Projects เดิมตามปีที่สร้างใน timezone Bangkok และชื่อ Sprint เดิม และสร้างประวัติเริ่มต้น โดยคง ID, Test cases, Results, Approvals และ Google Sheets เดิม

- Flow: Groups → ปี (ค.ศ.) → Sprint Dashboard → Projects แบบแถว → Project Workspace
- URL ของปี, Sprint และ Projects แยกกัน; URL Project เดิมยังเปิดได้ และปุ่มกลับพาไป Sprint ปัจจุบัน
- เจ้าของกลุ่ม, admin, qa_lead, qa และ System Owner เพิ่มปี/Sprint ได้ตามกลุ่มที่มีสิทธิ์ ผู้ดูอย่างเดียวอ่านได้
- เจ้าของ Project, ผู้จัดการกลุ่ม และ System Owner แก้ชื่อ/รายละเอียด/Environment และย้าย Sprint ภายในกลุ่มได้ทั้งในแถว Project และหน้า Settings ย้ายข้ามปีได้
- การแก้ไขและประวัติเกิดใน transaction เดียวกันที่ฐานข้อมูล; ไม่มีสิทธิ์เขียน/แก้/ลบประวัติผ่าน client; ป้องกันการบันทึกทับการแก้จากผู้อื่นด้วย updated_at
- Dashboard ใช้ข้อมูลที่บันทึกในฐานข้อมูล ไม่ดาวน์โหลด workbook/รูป Google Sheets แสดง Test cases ตาม attempt ล่าสุด, สถานะ, Defects ที่ยังเปิด, Projects approved และรออนุมัติ หาก Project มี PO หลายคนและมีคำขอ pending จะยังนับรออนุมัติ
- `npx tsx --test src/lib/planning-migration.test.ts` ทดสอบ migration, backfill, RLS และประวัติด้วย PostgreSQL ในเครื่อง ไม่ใช้ฐานข้อมูลจริง

## ส่งอีเมล Approval ผ่านโปรแกรมอีเมลบนเครื่อง

ระบบจะสร้างร่างอีเมลแล้วเปิดโปรแกรมอีเมลเริ่มต้นของเครื่องด้วย `mailto:` โดยใส่ผู้รับ, CC, หัวข้อ, เนื้อหา, ลิงก์หน้า Review และ Google Sheets ให้พร้อม จึงไม่ต้องเปิด Gmail API, Resend หรือขอสิทธิ์ส่งเมลเพิ่ม

บัญชีผู้ส่งจริงจะเป็นบัญชีที่ผู้ใช้เลือกไว้ใน Gmail/Outlook/Mail บนเครื่อง เพราะมาตรฐาน `mailto:` ไม่สามารถบังคับช่อง From จากเว็บไซต์ได้ ช่อง “ผู้ส่ง” ในหน้าเว็บใช้เป็นข้อมูลอ้างอิงเท่านั้น ระบบจะไม่สร้าง Approval ซ้ำสำหรับ Project และ PO คนเดิม

## ข้อจำกัด MVP

- การแก้ไขจากไฟล์จริงยังอยู่ใน state ของ browser จนกว่าจะเชื่อม data actions กับ Supabase
- ควรตรวจไฟล์ export ด้วย Microsoft Excel ก่อนใช้กับ template รูปแบบใหม่
