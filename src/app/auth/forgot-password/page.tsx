import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const sent = query.sent === "1";
  return <main className="login-screen"><section className="login-card password-card">
    <div className="login-brand"><span><KeyRound size={23} /></span><div><strong>QA Workspace</strong><small>ตั้งรหัสผ่าน</small></div></div>
    <div className="login-copy"><h1>ตั้งหรือลืมรหัสผ่าน</h1><p>กรอกอีเมลที่ System Owner อนุมัติไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ</p></div>
    {error && <p className="login-error">{error}</p>}
    {sent && <p className="login-success">ส่งลิงก์แล้ว กรุณาตรวจสอบ Inbox และ Spam ของอีเมล</p>}
    {!sent && <form className="password-login-form" action="/auth/password/forgot" method="post"><label><span>อีเมล</span><div><Mail size={17} /><input type="email" name="email" required autoComplete="email" placeholder="name@company.com" /></div></label><button className="google-login-button" type="submit">ส่งลิงก์ตั้งรหัสผ่าน</button></form>}
    <Link className="login-back-link" href="/auth/login">กลับหน้า Login</Link>
  </section></main>;
}
