# QA Result Workspace

MVP สำหรับนำเข้า Testcase จาก Excel, บันทึกผลการทดสอบ และส่งออกผลกลับลงสำเนา workbook เดิม

## ความสามารถในเวอร์ชันนี้

- Dashboard และรายการ Testcase พร้อมค้นหา/กรองสถานะ
- หน้า Projects โหลดรายการที่ผู้ใช้มีสิทธิ์เห็นจาก Supabase และเพิ่ม Project ใหม่ได้
- เข้าใช้งานได้โดยไม่ต้อง Login ในโหมดพัฒนา
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

เปิด `http://localhost:3000` จากนั้นเพิ่ม/เลือก Project แล้วกด **อัปโหลด Testcase**

ทดสอบ import/export กับ workbook จริง:

```bash
npm run test:excel -- /absolute/path/to/source.xlsx
```

## เชื่อม Supabase

1. สร้าง Supabase project
2. ใส่ Project URL และ Publishable key ใน `.env.local`
3. รัน migration ใน `supabase/migrations`
4. Migration `allow_public_project_catalog` จะเปิดสิทธิ์ anonymous เฉพาะอ่านและเพิ่ม Project

> โหมดไม่ Login ทำให้ทุกคนที่เข้าถึงแอปด้วย Supabase project เดียวกันมองเห็นรายการ Projects ทั้งหมด ควรนำ Auth กลับมาก่อนใช้งาน Production

ห้ามใส่ `service_role` หรือ secret key ในตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_`

## Deploy บน Netlify Free

1. นำ repository ขึ้น GitHub แล้วเลือก **Add new project > Import an existing project** ใน Netlify
2. Netlify จะใช้ `netlify.toml` และ Node.js 22 ให้อัตโนมัติ
3. คัดลอกชื่อตัวแปรทั้งหมดจาก `.env.example` ไปที่ **Project configuration > Environment variables** โดยใช้ค่าจริงจาก `.env.local`
4. ตั้ง `NEXT_PUBLIC_SITE_URL=https://ชื่อ-site.netlify.app` แล้วสั่ง Deploy ใหม่
5. ใน Supabase Auth > URL Configuration ตั้ง Site URL เป็นโดเมน Netlify และเพิ่ม `https://ชื่อ-site.netlify.app/auth/callback` ใน Redirect URLs
6. ใน Google OAuth Client เพิ่ม `https://ชื่อ-site.netlify.app` ใน Authorized JavaScript origins และเพิ่ม `https://ชื่อ-site.netlify.app/api/google/auth/callback` ใน Authorized redirect URIs

ห้าม commit `.env.local` หรือคัดลอก secret ลง `netlify.toml`

## ข้อจำกัด MVP

- การแก้ไขจากไฟล์จริงยังอยู่ใน state ของ browser จนกว่าจะเชื่อม data actions กับ Supabase
- หลักฐานไฟล์แนบเป็น UI placeholder และยังไม่ upload ไป R2
- Export อัปเดตฟิลด์ผลทดสอบในชีต Testcase แต่ยังไม่สร้างชีต RC ใหม่
- ควรตรวจไฟล์ export ด้วย Microsoft Excel ก่อนใช้กับ template รูปแบบใหม่
