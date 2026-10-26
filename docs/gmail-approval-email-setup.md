# ส่งอีเมล Approval จาก Gmail ของ QA แต่ละคน

ผู้ส่งจริงและ Reply-To เป็นอีเมล QA ที่เข้าสู่ระบบ สำหรับบัญชี `@gmail.com` ใช้ Google OAuth + Gmail API; บัญชี `@truecorp.co.th` ของทีมใช้ Outlook/Microsoft 365 ตาม [คู่มือตั้งค่าเมล QA](qa-mail-setup.md) ไม่ใช้บัญชีกลาง, App Password หรือโปรแกรม Outlook ผู้รับ, CC, หัวข้อ และเนื้อหายังแก้ไขได้

## ตั้งค่าก่อนใช้งานจริง

1. รัน migration `supabase/migrations/20261020040954_qa_gmail_connections.sql` ใน Supabase สร้างตารางเข้ารหัสแยกจาก Drive/Sheets มี RLS ให้แต่ละ QA เข้าถึงเฉพาะแถวของตน ไม่แก้ตารางสิทธิ์ Drive เดิม
2. Google Cloud **โปรเจคเดียวกับ GOOGLE_OAUTH_CLIENT_ID** → APIs & Services → Library → เปิด **Gmail API**
3. Google Auth Platform → Data Access เพิ่ม `https://www.googleapis.com/auth/gmail.send` และ `https://www.googleapis.com/auth/userinfo.email` สิทธิ์ส่งเป็น sensitive scope; หากแอปยังอยู่ Testing เพิ่ม QA เป็น Test users หรือดำเนินการ verification ก่อนเปิดใช้วงกว้าง ฝั่ง Workspace อาจต้องให้ IT อนุญาตแอป
4. OAuth Web client ต้องอนุญาต redirect URI เดิม `/api/google/auth/callback` ทั้ง `http://localhost:3002/api/google/auth/callback` และ `https://qaresulttestcase.netlify.app/api/google/auth/callback`
5. Netlify Functions ใช้ `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_COOKIE_SECRET` เดิม โดย encryption secret ต้องคงที่ ไม่เปลี่ยนโดยไม่มีแผนย้าย token และตั้ง `NEXT_PUBLIC_SITE_URL=https://qaresulttestcase.netlify.app` ให้ลิงก์รีวิวเปิดเว็บจริง
6. Deploy ใหม่ แล้วให้ QA กด **เชื่อม Gmail เพื่อส่งอีเมล** เลือกบัญชีเดียวกับที่ล็อกอินและอนุญาต Send หากเลือกบัญชีอื่นหรือไม่ให้ Send ระบบไม่บันทึกการเชื่อมต่อ กลับมาแล้วตรวจร่างและกดส่งเอง ไม่ส่งอัตโนมัติจาก OAuth callback
7. ทดลองส่งให้ผู้รับที่ตกลงกันก่อน ตรวจ Inbox/Junk และ Sent **ในบัญชี QA ผู้ส่ง** รวมถึงทดสอบเปิดลิงก์ด้วยบัญชี PO

localhost ใช้ OAuth env เดิมใน `.env.local` และ callback URI ของ localhost หลังเชื่อมจะกลับ localhost แต่ลิงก์ในอีเมลใช้เว็บจริง ไม่ต้องแจก secret หรือ App Password ให้ QA และไม่จำเป็นต้องใช้ `GMAIL_USER` / `GMAIL_APP_PASSWORD` อีกต่อไป

## ความหมายสถานะ

- สร้างคำขอ / กำลังส่ง ไม่ได้หมายความว่าส่งสำเร็จ
- Gmail รับไปส่งต่อแล้ว = Gmail API ตอบกลับ message ID ไม่ใช่หลักฐานว่าเข้า Inbox หรือ PO อ่านแล้ว อาจมี bounce/Junk ภายหลัง
- ส่งล้มเหลวหรือ timeout ให้ตรวจ Sent ก่อนลองใหม่ เพราะบางกรณี Gmail อาจรับอีเมลแล้วแต่การตอบกลับขาดหาย
- ส่งซ้ำใช้คำขอและลิงก์เดิม ไม่ reset Approved/ความเห็นของ PO; ส่งให้อีก PO ได้เป็นอีกคำขอ
- ป้องกันกดซ้ำพร้อมกัน และพัก 30 วินาทีหลังส่งสำเร็จต่อ Project/PO; คำขอที่ค้างรอยืนยันจะลองใหม่ได้หลัง 2 นาที ไม่ retry อัตโนมัติ

Refresh token บันทึกเข้ารหัสในฐานข้อมูลเฉพาะผู้ใช้ ไม่ใส่ token เมลใน cookie หรือส่งให้ browser ไม่ทับ token ของ Drive เมื่อ access token หมดอายุจะ refresh ฝั่ง server หากผู้ใช้ถอนสิทธิ์/Google ปฏิเสธ token จะให้เชื่อมใหม่ ไม่มี fallback ไปส่งจากบัญชีกลาง และไม่ retry การส่งอัตโนมัติเพราะอาจส่งซ้ำ

Google อาจกำหนดอายุ refresh token สั้นสำหรับ External app ที่อยู่ Testing จึงไม่รับประกันเชื่อมครั้งเดียวตลอดไป Gmail มีโควตาและไม่มีวิธีรับประกันไม่เข้า Junk

อ้างอิง: https://developers.google.com/workspace/gmail/api/guides/sending และ https://developers.google.com/workspace/gmail/api/auth/scopes
