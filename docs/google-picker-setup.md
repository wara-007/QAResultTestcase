# ตั้งค่าเลือกไฟล์จาก Google Drive

ใช้กับ Google Sheets และไฟล์ Excel `.xlsx` ที่เปิดผ่าน Google Sheets โดยไม่ต้องให้แอปอ่าน Drive ทั้งบัญชี และไม่แปลงหรือลบต้นฉบับ

## Google Cloud

เลือกโปรเจคเดียวกับ OAuth Client ID ที่ใช้ใน `GOOGLE_OAUTH_CLIENT_ID`

1. APIs & Services → Library: เปิด **Google Picker API** และ **Google Drive API**
2. APIs & Services → Credentials → Create credentials → API key
3. ตั้ง Application restrictions เป็น **Websites** และอนุญาต:
   - `http://localhost:3002/*` (เพิ่ม port อื่นด้วยถ้าใช้)
   - `https://qaresulttestcase.netlify.app/*`
   - `https://docs.google.com/*` เพราะ Picker แสดงผ่าน iframe ของ Google
4. ตั้ง API restrictions ให้ใช้ได้เฉพาะ **Google Picker API** และ **Google Drive API**
5. IAM & Admin → Settings: คัดลอก **Project number** (ตัวเลข ไม่ใช่ Project ID หรือชื่อ)
6. OAuth Web client → Authorized JavaScript origins: ต้องมี origin ที่ใช้งาน เช่น `http://localhost:3002` และ `https://qaresulttestcase.netlify.app`

API key, Project number และ OAuth Client ID ต้องมาจากโปรเจคเดียวกัน

## Environment

เพิ่มใน `.env.local` และ Environment variables ของ Netlify:

```dotenv
GOOGLE_PICKER_API_KEY=your-restricted-browser-api-key
GOOGLE_CLOUD_PROJECT_NUMBER=your-numeric-project-number
```

เครื่อง local ให้ restart dev server ส่วน Netlify ให้ deploy ใหม่หลังตั้งค่า ไม่ต้องรัน SQL

API key นี้จะถูกส่งให้ Google Picker ในเบราว์เซอร์ จึงต้องจำกัดเว็บไซต์และ API ตามด้านบน ห้ามใช้ OAuth Client Secret, Service Account private key หรือ Supabase Secret key แทน

## วิธีใช้งาน

- Project ใหม่: เลือกแท็บ Google Sheets URL → **เลือกไฟล์จาก Google Drive** → เลือกไฟล์ → เพิ่ม Project
- Project เดิม: กด **เลือกไฟล์จาก Google Drive** ในหัว Project → เลือกไฟล์เดิม → ระบบโหลดข้อมูลใหม่ให้
- เปลี่ยนต้นฉบับ: ตั้งค่า Project → ตั้งค่า Google Sheet → เลือกไฟล์ → เชื่อม Sheet
- หากยังไม่เคยเชื่อม Google ระบบจะแสดงลิงก์เชื่อม Google โดยกลับมาหน้าเดิมหลังอนุญาต
- บัญชีใน Picker จะเป็นบัญชี Google ที่เชื่อมกับเว็บ ไม่จำเป็นต้องตรงกับบัญชีที่เปิด Google ในแท็บอื่น หากหาไฟล์ไม่พบให้ตรวจบัญชีและสิทธิ์แชร์ก่อน
- ผลจากไฟล์ Excel บันทึกในเว็บและดาวน์โหลดได้ การซิงค์กลับยังรองรับเฉพาะ native Google Sheets

ระบบส่งเฉพาะ access token ชั่วคราวให้ Picker ไม่ส่ง refresh token หรือ OAuth Client Secret และไม่เก็บ access token ใน localStorage

อ้างอิง: [Google Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample), [สิทธิ์ drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
