# ส่งจริงจากบัญชี QA: Gmail และ Outlook / Microsoft 365

QA ระบุอีเมลผู้ส่งและส่งถึง PO/CC ได้ทุกโดเมนที่เป็นอีเมลถูกต้อง การส่งตรงจากเว็บต้องเชื่อมสิทธิ์ mailbox ของอีเมลผู้ส่งที่เลือก การล็อกอินเข้าเว็บอย่างเดียวไม่ให้สิทธิ์ส่งเมล

- QA `@gmail.com`: Gmail API ตาม [คู่มือ Gmail](gmail-approval-email-setup.md)
- QA `@truecorp.co.th`: ค่าเริ่มต้นคือโหมดคัดลอกไปส่งเองและยืนยันการส่ง ไม่ต้องตั้งค่า Microsoft OAuth; เลือกส่งตรงจากเว็บผ่าน Microsoft Graph ได้หากบริษัทอนุญาตและเชื่อมสิทธิ์แล้ว
- PO ใช้ Gmail, Outlook หรือโปรแกรมเมลอื่นได้ กด Reply ในเมลที่ได้รับเพื่อตอบกลับ QA คำตอบอยู่ใน Inbox ของ QA ไม่ต้องผ่านระบบเรา
- ไม่อ่าน Inbox ของ QA/PO และไม่แปลงข้อความ Reply เป็นการ Approved อัตโนมัติ
- ไม่มี fallback ส่งผ่านบัญชีกลาง โหมดส่งตรงที่ provider ไม่อนุญาตจะหยุดและแจ้งข้อผิดพลาด โหมด Outlook เป็นตัวเลือกที่ผู้ใช้เลือกอย่างชัดเจน

## เลือกโหมดส่งคำขอ Approve

หน้า PO Approval แบ่งเป็นแท็บสองโหมดสำหรับผู้ส่งทั้ง Gmail และ `@truecorp.co.th`:

- **ส่งอีเมลจากเว็บ**: ใช้ OAuth/ผู้ให้บริการเหมือนเดิม Gmail ต้องเชื่อมบัญชีก่อนส่ง ส่วนบัญชีบริษัทที่ยังไม่มี grant ส่งเมล ปุ่มส่งจะ disabled และแสดงเหตุผลชัดเจน แต่ยังเปิดแท็บเพื่อแก้ผู้ส่งได้
- **คัดลอกไปส่งเอง**: ค่าเริ่มต้นของผู้ส่งบริษัท ไม่ต้องตั้งค่า Microsoft OAuth เว็บเตรียมข้อมูลและลิงก์ให้คัดลอก ผู้ใช้ส่งจากโปรแกรมเมลของตนเอง แล้วกด “ยืนยันว่าส่งคำขอ Approve แล้ว”

### ส่งเองและยืนยัน

1. แท็บคัดลอกแสดงชื่อโปรเจกต์และเนื้อหาอีเมลเป็นหลัก ตั้งค่าเฉพาะอีเมล PO ได้ในส่วน “ตั้งค่าลิงก์ Approve” ที่แสดงตลอดเหนือปุ่มคัดลอก ต้องระบุ PO เพื่อกำหนดสิทธิ์เปิดลิงก์ นำเข้าหลักฐานให้ครบเหมือนโหมดส่งตรง แล้วกดปุ่ม “คัดลอกเนื้อหาและลิงก์ Approve” ใต้เนื้อหา โหมดคัดลอกไม่ต้องระบุอีเมลผู้ส่ง เว็บจะเตรียมลิงก์แล้วคัดลอกให้ก่อนเปิดร่าง หาก browser ไม่อนุญาตการคัดลอกหลังรอ server ให้ใช้ปุ่มคัดลอกในหน้าร่างแทน มีปุ่มคัดลอกชื่อโปรเจกต์ข้างช่องชื่อด้วย
2. เว็บตรวจสิทธิ์แก้ไข Project และหลักฐาน สร้าง/ใช้คำขอ Approve เดิมและเก็บร่างเต็มแบบ transaction เดียว โดยไม่เรียก Microsoft Graph หรือ Gmail
3. หน้าคัดลอกมีเฉพาะชื่อโปรเจกต์สำหรับใช้เป็นหัวข้อ และเนื้อหาพร้อมลิงก์ Approve ไม่มีช่องผู้รับ/CC/หัวข้อแยก และไม่มีปุ่ม mailto หรือเปิดโปรแกรมเมล ข้อความยาวและภาษาไทยไม่ถูกตัด ชื่อโปรเจกต์ถูกบันทึกในร่างเพื่อให้กลับมาเปิดซ้ำได้ถูกต้อง
4. หลังส่งจริงแล้วกด “ยืนยันว่าส่งคำขอ Approve แล้ว” ระบบบันทึกบัญชีผู้ใช้ ชื่อ และเวลา ไม่ถือว่า PO อนุมัติ และไม่บันทึกเป็นผลนำส่งจาก provider
5. สถานะก่อนยืนยัน: “เตรียมแล้ว · ยังไม่ยืนยันการส่ง” หลังยืนยัน: “ผู้ใช้ยืนยันว่าส่งแล้ว” พร้อมชื่อและเวลา ผล Approved ยังคงมาจาก PO ที่เปิดลิงก์และอนุมัติจริงเท่านั้น
6. ปิด/โหลดหน้าใหม่แล้วเปิดร่างเดิมจาก “เปิดร่าง / ยืนยันการส่ง” ได้ การเตรียมอัปเดตจะได้รอบใหม่ที่ยังไม่ยืนยัน โดยเก็บประวัติรอบเก่าและรักษาผล PO/ลิงก์เดิม ร่างเก่าที่ถูกแทนที่ไม่สามารถยืนยันเป็นรอบปัจจุบันได้ กดยืนยันซ้ำไม่เปลี่ยนผู้ยืนยันหรือเวลาเดิม

### แท็บส่งผ่าน Gmail

เมื่อเลือกแท็บส่งจากเว็บและผู้ส่งเป็น Gmail มีคำเตือนก่อนส่งว่าเมลอาจเข้า Junk/Spam ตามนโยบายกรองของบริษัทผู้รับ ความน่าเชื่อถือผู้ส่ง หรือผลตรวจสอบตัวตนอีเมล ระบุว่าเป็นสาเหตุที่เป็นไปได้ ไม่ยืนยันสาเหตุของเมลแต่ละฉบับ แนะนำให้ PO ตรวจ Junk/Spam และกด Not junk หลังตรวจว่าเป็นเมลจากผู้ส่งจริง มีลิงก์อ้างอิง [Microsoft Defender anti-spam FAQ](https://learn.microsoft.com/en-us/defender-office-365/anti-spam-protection-faq)

แท็บยังเปิดได้แม้ยังส่งไม่ได้ เพื่อให้แก้อีเมลผู้ส่งได้ ปุ่มส่งจริงยังตรวจและ disabled ตามสิทธิ์เหมือนเดิม ใช้ปุ่มลูกศรซ้าย/ขวาหรือ Home/End สลับแท็บได้

### ฐานข้อมูลและการตรวจสอบ

ต้อง deploy migration `supabase/migrations/20261030022400_project_approval_manual_deliveries.sql` ก่อนใช้โหมดนี้ ตาราง `project_approval_manual_deliveries` เก็บ draft JSON ที่ผ่าน validation และการยืนยันแต่ละรอบ มี RLS และไม่เปิดสิทธิ์ให้ anon/authenticated อ่านหรือแก้ไขโดยตรง Functions `prepare_project_approval_manual_delivery` และ `confirm_project_approval_manual_delivery` ใช้ invoker rights และเรียกได้เฉพาะ service_role หลัง server action ตรวจสิทธิ์ Project แล้ว `email_sent_at` ยังคง null ในโหมดส่งเอง

ตรวจจริง: บัญชีบริษัทที่ไม่ได้ตั้งค่า Microsoft OAuth ต้องเลือกคัดลอก เตรียมร่าง เปิดซ้ำหลังโหลดหน้าใหม่ และยืนยันการส่งได้ ปุ่มส่งจากเว็บต้องถูก disabled ตามสถานะ grant ทดสอบผู้ใช้ไม่มีสิทธิ์ Project และการเปิดร่างเก่าไว้ขณะอีกคนเตรียมรอบใหม่ รวมถึงตรวจว่า PO decision และลิงก์เดิมยังอยู่ ไม่ส่งเมลจริงโดยไม่มีผู้รับทดสอบที่ได้รับอนุญาต

หมายเหตุ: API โหมด Outlook เดิมยังรองรับหน้าเว็บที่เปิดค้างระหว่าง deploy แต่หน้าจอปัจจุบันใช้โหมดคัดลอกแทนการเปิด Outlook

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
