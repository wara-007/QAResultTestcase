# ส่งจริงจากบัญชี QA: Gmail และ Outlook / Microsoft 365

QA ส่งเมลจากเว็บถึง PO/CC ได้ทุกโดเมนที่เป็นอีเมลถูกต้อง โดย From และ Reply-To ตรงกับบัญชี QA ที่ล็อกอิน ผู้ส่งต้องอนุญาตสิทธิ์ mailbox ของตนเองก่อน การล็อกอินเข้าเว็บอย่างเดียวไม่ให้สิทธิ์ส่งเมล

- QA `@gmail.com`: Gmail API ตาม [คู่มือ Gmail](gmail-approval-email-setup.md)
- QA `@truecorp.co.th`: Microsoft 365 ผ่าน Microsoft Graph ตามขั้นตอนด้านล่าง
- PO ใช้ Gmail, Outlook หรือโปรแกรมเมลอื่นได้ กด Reply ในเมลที่ได้รับเพื่อตอบกลับ QA คำตอบอยู่ใน Inbox ของ QA ไม่ต้องผ่านระบบเรา
- ไม่อ่าน Inbox ของ QA/PO และไม่แปลงข้อความ Reply เป็นการ Approved อัตโนมัติ
- ไม่มี fallback เป็นบัญชีกลางหรือ mailto; หาก provider ไม่อนุญาตจะหยุดและแจ้งข้อผิดพลาด

## ตั้งค่า Microsoft ก่อนเปิดใช้

1. ให้ผู้ดูแล Microsoft Entra ของบริษัทสร้าง App Registration แบบ single tenant ใน tenant ที่ใช้ mailbox `@truecorp.co.th` ตรวจว่าบัญชีดังกล่าวเป็น Exchange Online mailbox ที่ Graph เข้าถึงได้
2. Authentication → เพิ่มแพลตฟอร์ม **Web** ลงทะเบียน redirect URI ให้ตรงทุกตัวอักษร:
   - `http://localhost:3002/api/microsoft/auth/callback` (หาก dev ใช้ port อื่น ให้ลงทะเบียน port นั้นด้วย)
   - `https://qaresulttestcase.netlify.app/api/microsoft/auth/callback`
3. เพิ่ม Microsoft Graph **Delegated permissions** `User.Read` และ `Mail.Send` แอปใช้ OIDC scopes `openid`, `profile`, `email`, `offline_access` สำหรับเชื่อมบัญชีและ refresh; ไม่ใช้ application-wide Mail.Send และไม่ขอ Mail.Read
4. ตรวจนโยบาย user consent ของ tenant หากบริษัทกำหนดให้ IT อนุญาต ให้ดำเนินการ admin consent ตามนโยบาย ไม่ถือว่า QA ทุกคนอนุญาตได้เองเสมอ
5. สร้าง client secret และกำหนดค่าฝั่ง server ทั้ง dev และ Netlify Functions:
   - `MICROSOFT_TENANT_ID`: Directory (tenant) ID แบบ UUID ของบริษัท
   - `MICROSOFT_CLIENT_ID`: Application (client) ID
   - `MICROSOFT_CLIENT_SECRET`: secret value ไม่ใช่ secret ID
   - `MAIL_TOKEN_ENCRYPTION_SECRET`: ค่าสุ่มอย่างน้อย 32 ตัวอักษร เก็บคงที่ ห้ามเผยแพร่หรือใส่ prefix `NEXT_PUBLIC_`
   - `NEXT_PUBLIC_SITE_URL=https://qaresulttestcase.netlify.app` เพื่อให้ลิงก์รีวิวชี้เว็บจริง
6. รัน migration `supabase/migrations/20261022161131_qa_microsoft_mail_connections.sql` ผ่านขั้นตอน deployment migration ของโปรเจกต์ ตารางแยกจาก Gmail/Drive/Sheets มี RLS จำกัด QA แต่ละคน การพัฒนาในเครื่องไม่ได้รัน migration บนฐานข้อมูลจริงให้อัตโนมัติ
7. Deploy แล้วล็อกอินด้วย QA `@truecorp.co.th` เปิด Project และกด **เชื่อม Microsoft 365 / Outlook เพื่อส่งอีเมล** เลือกบัญชีเดียวกับ QA ที่ล็อกอิน อนุญาตส่งเมล แล้วกลับมาตรวจร่างและกดส่งเอง

## ข้อกำหนดบัญชีผู้ส่ง

แอปตรวจ `mail` ของ Microsoft profile ให้ตรงกับอีเมล QA ไม่เชื่อเฉพาะ UPN ที่อาจเป็น alias ต่างจาก primary mailbox หากไม่ตรง ต้องให้ IT ตรวจ primary SMTP address และบัญชีที่ลงทะเบียนกับแอป ไม่มีการส่งแทน shared mailbox หรือ alias อื่น

MSAL cache เก็บเข้ารหัสฝั่ง server แยกตาม QA access token/refresh token ไม่ส่งให้ browser และไม่บันทึกใน logs เมื่อ token ต้อง refresh จะบันทึก cache ใหม่ก่อนส่ง หากถอนสิทธิ์หรือ Conditional Access ต้องโต้ตอบใหม่ QA ต้องกดเชื่อมอีกครั้ง

หากเปลี่ยน encryption secret โดยไม่ย้ายข้อมูล ต้องให้ QA เชื่อมบัญชีใหม่ ห้ามใช้ secret ตัวอย่างใน production

## ตรวจส่งและ Reply จริง

ใช้ผู้รับทดสอบที่เจ้าของงานระบุและยินยอมรับเมล:

1. QA Gmail ส่งไป PO Outlook และ QA Microsoft 365 ส่งไป PO Gmail/Outlook
2. ตรวจ From และ Reply-To ให้ตรงกับ QA ตรวจ Subject, CC, สรุปผล, URL รีวิว และ Google Sheet
3. ตรวจ Sent ของ QA และ Inbox/Junk ของ PO แล้วให้ PO กด Reply ในเมลฉบับนั้น ตรวจ To เป็น QA และคำตอบเข้าถึง Inbox/Junk ของ QA
4. ตรวจว่าเลือก Microsoft account คนอื่นเชื่อมไม่ได้ ไม่มีการส่งอัตโนมัติจาก OAuth callback และร่างยังอยู่เมื่อกลับจากการเชื่อมบัญชี
5. ทดลองส่งซ้ำหลังช่วงพัก ตรวจว่าสถานะ Approved/ความเห็นและลิงก์เดิมไม่ถูก reset

ชุดทดสอบโค้ดที่จำลอง provider ไม่ถือเป็นหลักฐานว่าเมลจริงถึงผู้รับ การยืนยันนี้ต้องทำหลังตั้งค่า tenant และเชื่อมบัญชีจริง

## ความหมายสถานะ

- Gmail API รับเมล: มี Gmail message ID
- Microsoft Graph รับคำขอ: HTTP 202 ไม่มี message ID ใน response ระบบเก็บ local operation reference สำหรับติดตาม ซึ่งไม่ใช่ Graph message ID
- Provider accepted ไม่รับรองเข้า Inbox หรืออ่านแล้ว ยังมีโอกาสถูกนโยบายบริษัท, quota หรือ spam filter จัดการภายหลัง
- Timeout หลังเริ่มส่ง: สถานะยังยืนยันไม่ได้ ไม่ retry อัตโนมัติ ให้ตรวจ Sent Items ก่อนส่งใหม่
- ป้องกัน concurrent send และพัก 30 วินาทีหลัง accepted ต่อ Project/PO; pending/unknown พักอย่างน้อย 2 นาทีเพื่อเลี่ยงกดซ้ำ
- การเชื่อม/ส่ง Microsoft ไม่เปลี่ยนสิทธิ์ Drive/Sheets ที่ใช้ดูผลหรือหลักฐาน

ระบบเตือนตามเวลาและเมลแจ้งผลกลับ QA ยังเป็นงานส่วนถัดไป ไม่ได้เปิด schedule ในส่วนส่งจริงนี้

อ้างอิง:
- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests
