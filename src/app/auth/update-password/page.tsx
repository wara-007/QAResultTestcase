import { redirect } from "next/navigation";
import { KeyRound, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login");
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  return <main className="login-screen"><section className="login-card password-card">
    <div className="login-brand"><span><KeyRound size={23} /></span><div><strong>QA Workspace</strong><small>ตั้งรหัสผ่านใหม่</small></div></div>
    <div className="login-copy"><h1>สร้างรหัสผ่านใหม่</h1><p>ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร หลังบันทึกแล้วคุณจะใช้ Email + Password เข้าระบบได้</p></div>
    {error && <p className="login-error">{error}</p>}
    <form className="password-login-form" action="/auth/password/update" method="post">
      <label><span>รหัสผ่านใหม่</span><div><LockKeyhole size={17} /><input type="password" name="password" required minLength={8} autoComplete="new-password" /></div></label>
      <label><span>ยืนยันรหัสผ่าน</span><div><LockKeyhole size={17} /><input type="password" name="confirmation" required minLength={8} autoComplete="new-password" /></div></label>
      <button className="google-login-button" type="submit">บันทึกรหัสผ่าน</button>
    </form>
  </section></main>;
}
