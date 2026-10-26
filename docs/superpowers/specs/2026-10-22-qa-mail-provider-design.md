# ส่งอีเมลจากบัญชี QA ผ่าน Gmail และ Microsoft 365

วันที่: 2026-10-22
สถานะ: ผู้ใช้อนุมัติให้ทำต่อแล้ว 2026-10-22; พัฒนาส่วนส่งจริงในเครื่อง รอการตั้งค่า Microsoft และทดสอบส่งจริง

## เป้าหมายที่ผู้ใช้ระบุ

QA กดส่งอีเมลจากเว็บถึงอีเมลผู้รับใดก็ได้ โดยส่งจริงจากบัญชีเดียวกับที่ล็อกอินเว็บ ไม่ใช้บัญชีกลาง เมื่อ PO กด Reply ในโปรแกรมอีเมล คำตอบต้องกลับเข้า mailbox ของ QA ผู้ส่ง ส่วน From ของคำตอบเป็นบัญชี PO ตามปกติ

ตามการใช้งานของทีม บัญชี `@gmail.com` ใช้ Gmail และ `@truecorp.co.th` ใช้ Microsoft 365 ไม่เลือก provider จากโดเมนผู้รับ ไม่อนุมานว่าโดเมนอื่นเป็น Microsoft โดยอัตโนมัติ

## ขอบเขตและลำดับส่งมอบ

ส่วนแรกทำให้ QA ส่งคำขอ Approve จริงได้ทั้งสอง provider และยืนยันเส้นทาง Reply ก่อน ส่วนถัดไปต่อยอดการเตือน PO ค้างและแจ้งผลกลับ QA ตามที่ผู้ใช้เลือกไว้ การส่งอีเมลขออนุมัติเริ่มจากการกดของ QA เสมอ

การตอบเมลไม่เปลี่ยนสถานะอนุมัติอัตโนมัติ PO ยังใช้หน้า Review เพื่อ Approved หรือขอแก้ไข ไม่เพิ่มสิทธิ์อ่าน Inbox เพื่อรองรับการตอบเมลตามปกติ

## สภาพปัจจุบันจากโค้ด

- `google-mail-server.ts` ตรวจบัญชี Gmail กับ QA และส่งผ่าน Gmail API
- `approval-email.ts` กำหนด From และ Reply-To เป็น QA แต่สถานะ/ข้อความบางส่วนยังผูกกับ Gmail
- `actions.ts` เรียก Gmail โดยตรง มีการกันส่งพร้อมกันและ cooldown แล้ว
- `qa-workspace.tsx` แสดงการเชื่อม Gmail ยังไม่มี Microsoft
- ไม่พบ Microsoft OAuth หรือ Microsoft environment configuration ในตัวอย่างการตั้งค่า
- README ยังอธิบาย mailto ซึ่งไม่ตรงกับโค้ดส่ง Gmail ปัจจุบัน
- มีงาน Gmail ที่แก้ไขค้างอยู่ใน working tree ต้องต่อยอดโดยเก็บงานเดิม

## ทางเลือกและแนวทางที่เลือกเสนอ

1. เปิดร่างในโปรแกรมเมล: ไม่ตอบโจทย์การส่งจริงจากเว็บและการยืนยันบัญชีผู้ส่ง
2. บัญชีกลาง: ไม่ตรงกับข้อกำหนดผู้ใช้
3. Delegated OAuth ของ QA แต่ละคน: ใช้แนวทางนี้ ให้แต่ละ provider ส่งจาก mailbox ที่ผู้ใช้อนุญาต

## การเชื่อมบัญชีและการส่ง

การล็อกอิน Supabase เป็นการเข้าเว็บ ต้องเชื่อมสิทธิ์ส่งเมลแยกต่างหากโดยไม่เปลี่ยนระบบล็อกอินเดิม

- Gmail คง flow เดิมและตรวจบัญชีที่เชื่อมตรงกับอีเมล QA
- Microsoft ใช้ Entra application ขององค์กร, authorization-code flow พร้อม PKCE ผ่าน Microsoft-supported library และ delegated scopes สำหรับระบุตัวตน ส่งเมล และ refresh สิทธิ์
- ขอ `Mail.Send`, `User.Read`, `openid`, `profile`, `email`, `offline_access`; ไม่ขอ application-wide Mail.Send
- ผูก OAuth state กับ QA ปัจจุบัน มีอายุสั้น ใช้ callback และ return path ที่ตรวจแล้ว ล้าง state หลังใช้งาน และห้ามส่งจาก callback
- ตรวจบัญชี mailbox จริงจาก Microsoft ก่อนบันทึกและก่อนส่ง ไม่เชื่อ email หรือ From จาก browser; หาก email/UPN ไม่ยืนยัน mailbox ที่ตรงกัน ให้ปฏิเสธและแจ้งชัดเจน
- ส่ง Microsoft ผ่าน `/me/sendMail` กำหนด Reply-To เป็น QA และเก็บ Sent Items ใช้ provider เป็นผู้กำหนด mailbox ผู้ส่ง ไม่ปลอม From
- To และ CC รับอีเมลที่ถูกต้องทุกโดเมน ใช้ validation/ขีดจำกัดเดิม การส่งยังอยู่ภายใต้นโยบายและโควตาของผู้ให้บริการ

## ขอบเขตโค้ดและข้อมูล

เพิ่ม interface กลางสำหรับ connection status, connect URL, sender และ delivery result แล้วห่อ Gmail ของเดิมด้วย interface นี้ เพิ่ม Microsoft adapter โดยแยกจาก Drive/Sheets

เก็บ Microsoft token cache แบบเข้ารหัสฝั่ง server แยกตารางตาม user ID มี RLS จำกัดเจ้าของและสิทธิ์ worker ที่จำเป็น เก็บ refresh/cache ที่อัปเดตแล้วกลับฐานข้อมูล ห้ามส่ง tokens ไป client หรือบันทึกใน logs ใช้ encryption secret ฝั่ง server ที่คงที่

Microsoft configuration ที่ต้องเตรียม: tenant ID, client ID, client secret, callback URI ที่ลงทะเบียน และ encryption secret; ไม่มีค่าใดใช้ NEXT_PUBLIC ยกเว้น site URL เดิม

ปรับ UI จากข้อความ Gmail แบบตายตัวเป็น provider ของ QA พร้อมสถานะ ยังไม่เชื่อม / เชื่อมแล้ว / ต้องเชื่อมใหม่ / ยังไม่ได้ตั้งค่าระบบ ไม่ fallback ไปบัญชีกลางหรือ provider อื่น

## สถานะส่งและข้อผิดพลาด

แยกสถานะส่งเมลจาก pending/approved/changes_requested/revoked ของคำขอ ใช้สถานะ queued/sending/accepted/failed/unknown สำหรับประวัติส่ง และแยก provider request ID ออกจาก message ID

Graph ส่งสำเร็จด้วย HTTP 202 และไม่มี response body จึงห้ามใช้เงื่อนไขต้องมี message ID แบบ Gmail การ accepted หมายถึงผู้ให้บริการรับคำขอ ไม่ใช่เข้า Inbox หรืออ่านแล้ว

กันกดซ้ำและ concurrent send ต่อคำขอ หาก timeout หรือ connection ขาดหลังเริ่มส่ง ให้ unknown และไม่ retry อัตโนมัติ แนะนำตรวจ Sent Items ก่อนกดส่งใหม่ หากถอนสิทธิ์/refresh ไม่สำเร็จ ให้เชื่อมใหม่ ส่งล้มเหลวไม่ล้างผลอนุมัติเดิม

## ส่วนถัดไป: เตือนและแจ้งผล

ใช้ outbox และประวัติแต่ละ delivery โดยผูกกับ QA เจ้าของรอบคำขอ การบันทึกผล PO กับงานแจ้งผลต้องอยู่ใน transaction เดียวกัน worker ใช้สิทธิ์ส่งของ QA คนนั้น ไม่ต้องมี browser session และไม่ fallback ไปบัญชีกลาง หากสิทธิ์ขาด ให้พักงานและแสดงเหตุผลแก่ QA

ข้อเสนอค่าเริ่มต้นสำหรับการเตือน: 2 และ 4 วันทำการ เวลา 09:00 Asia/Bangkok จันทร์–ศุกร์ ไม่รวมการคำนวณวันหยุดราชการในรอบแรก ต้องให้ผู้ใช้ยืนยันนโยบายก่อนเปิด schedule จริง หยุดเมื่อมีคำตอบ ยกเลิก หรือสิทธิ์เข้าถึงหมดอายุ ตรวจสถานะอีกครั้งก่อนส่ง และใช้ unique event key/lease ป้องกัน worker ทำงานซ้ำ

แจ้งผลกลับ QA ใช้บัญชี QA เจ้าของคำขอเป็นผู้ส่งและผู้รับตามข้อกำหนดไม่ใช้บัญชีกลาง โดยเนื้อหาระบุ PO ผู้ตัดสินจริงอย่างชัดเจน การเปิดส่วนนี้ต้องแจ้ง UX เรื่องเมลแจ้งตัวเองให้ผู้ใช้ตรวจอีกครั้ง

แยกส่งอัปเดตที่คงผลเดิมออกจากขอรีวิวรอบใหม่ รอบใหม่เก็บประวัติเก่าและเริ่ม pending ห้าม reset ผลเดิมจากการเตือน

## การตรวจสอบก่อนส่งมอบ

ทดสอบเลือก provider จากผู้ส่ง, ปฏิเสธบัญชีเชื่อมไม่ตรง QA, OAuth state/PKCE/return path, RLS ไม่อ่าน token ของผู้อื่น, refresh token/cache persistence, To/CC/Reply-To, Graph 202 ไม่มี body, timeout ไม่ retry, concurrent send และการคงผลอนุมัติเดิม

รัน typecheck, lint เฉพาะส่วนเปลี่ยน และ tests ที่เกี่ยวข้อง หลังอ่าน Next.js guides ใน node_modules/next/dist/docs ก่อนเขียนโค้ด

การยืนยันส่งจริงต้องมีบัญชี QA ที่ยินยอมเชื่อมและผู้รับทดสอบที่ผู้ใช้ระบุ ตรวจ Gmail ไป Outlook และ Microsoft ไป Gmail ว่า From/Reply-To ถูกต้อง Sent Items มีรายการ และ PO Reply กลับ QA ได้ การทดสอบ mock ไม่ถือเป็นหลักฐานการส่งจริง

## เงื่อนไขเปิดใช้งาน Microsoft

ต้องมี Entra App Registration และ redirect URI สำหรับ localhost/production พร้อม client credentials ฝั่ง server องค์กรอาจกำหนดให้ IT อนุญาต consent และการส่งออกภายนอก ต้องตรวจบน tenant จริง จึงยังยืนยันการส่งจาก @truecorp.co.th ไม่ได้จากโค้ดในเครื่องเพียงอย่างเดียว

## อ้างอิงที่ตรวจแล้ว

- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
