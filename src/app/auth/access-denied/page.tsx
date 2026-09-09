import Link from "next/link";
import { LockKeyhole, LogIn } from "lucide-react";
import { signOut } from "@/app/auth/actions";

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  return <main className="auth-screen">
    <section className="auth-card access-denied-card">
      <div className="auth-icon denied"><LockKeyhole size={24} /></div>
      <p className="eyebrow">ACCESS REQUIRED</p>
      <h1>บัญชีนี้ยังไม่ได้รับอนุมัติ</h1>
      <p>{email ? <>กรุณาให้ System Owner เพิ่มอีเมล <strong>{email}</strong> ในหน้าจัดการสิทธิ์ก่อนเข้าใช้งาน</> : "กรุณาติดต่อ System Owner เพื่อขอสิทธิ์เข้าใช้งาน QA Result Workspace"}</p>
      <form action={signOut}><button className="primary-button" type="submit"><LogIn size={16} />Login ด้วยบัญชีอื่น</button></form>
      <nav className="login-legal"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav>
    </section>
  </main>;
}
