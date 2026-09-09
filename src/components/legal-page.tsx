import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

export function LegalPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="legal-screen">
    <header className="legal-header">
      <Link href="/auth/login" className="legal-brand"><span><ClipboardCheck size={21} /></span><strong>QA Result Workspace</strong></Link>
      <nav><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav>
    </header>
    <article className="legal-document">
      <p className="eyebrow">QA RESULT WORKSPACE</p>
      <h1>{title}</h1>
      <p className="legal-subtitle">{subtitle}</p>
      {children}
    </article>
    <footer className="legal-footer">© 2026 QA Result Workspace · <a href="mailto:warawut_pum@truecorp.co.th">Contact</a></footer>
  </main>;
}
