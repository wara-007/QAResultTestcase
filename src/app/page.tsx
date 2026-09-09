import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bug, CheckCircle2, ClipboardCheck, FileSpreadsheet, ImagePlus, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "QA Result Workspace | Test execution and evidence",
  description: "Workspace for authorized QA teams to manage test cases, results, defects, Google Sheets synchronization, and test evidence.",
};

const features = [
  { icon: ClipboardCheck, title: "Test cases & results", description: "บันทึกผลทดสอบหลายรอบ พร้อมข้อมูลอุปกรณ์ Environment, API response และ Log" },
  { icon: ImagePlus, title: "Evidence", description: "แนบและเปิดดูรูปหลักฐานที่ QA อัปโหลดไปยัง Google Drive ผ่านระบบ" },
  { icon: FileSpreadsheet, title: "Google Sheets", description: "นำเข้า Test case และซิงค์ผลกลับไปยัง Google Sheets ของ Project" },
  { icon: Bug, title: "Defect tracking", description: "บันทึก Defect สถานะ รายละเอียด และเชื่อมโยง Jira กับ Test case" },
];

export default function HomePage() {
  return <main className="public-home">
    <header className="public-nav">
      <Link className="public-brand" href="/"><span><ClipboardCheck size={21} /></span><div><strong>QA Result Workspace</strong><small>Test execution & evidence</small></div></Link>
      <nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link className="primary-button" href="/auth/login">เข้าสู่ระบบ<ArrowRight size={15} /></Link></nav>
    </header>
    <section className="public-hero">
      <div className="public-hero-copy">
        <p className="eyebrow">QUALITY ASSURANCE WORKSPACE</p>
        <h1>จัดการ Test case ผลทดสอบ และหลักฐานในที่เดียว</h1>
        <p>พื้นที่ทำงานสำหรับทีม QA ที่ได้รับอนุญาต เพื่อบริหาร Project บันทึก Result และ Defect พร้อมเชื่อมต่อ Google Sheets และ Google Drive</p>
        <div className="public-actions"><Link className="primary-button" href="/auth/login">เข้าสู่ระบบด้วย Google<ArrowRight size={16} /></Link><a className="secondary-button" href="#features">ดูความสามารถ</a></div>
        <div className="public-trust"><ShieldCheck size={17} /><span>ระบบอนุญาตเฉพาะอีเมลที่ System Owner เพิ่มไว้ และขอสิทธิ์เฉพาะเพื่อให้บริการฟังก์ชันที่ผู้ใช้สั่งงาน</span></div>
      </div>
      <div className="public-preview" aria-label="ตัวอย่างขั้นตอนการทำงาน">
        <p>QA WORKFLOW</p>
        <ol><li><span>1</span><div><strong>Import test cases</strong><small>จาก Excel หรือ Google Sheets</small></div><CheckCircle2 size={18} /></li><li><span>2</span><div><strong>Execute & record</strong><small>เพิ่ม Result, Evidence และ Defect</small></div><CheckCircle2 size={18} /></li><li><span>3</span><div><strong>Sync results</strong><small>อัปเดตกลับไปยัง Google Sheets</small></div><FileSpreadsheet size={18} /></li></ol>
      </div>
    </section>
    <section className="public-features" id="features">
      <div className="public-section-heading"><p className="eyebrow">CORE FEATURES</p><h2>สร้างมาเพื่อขั้นตอนการทดสอบจริง</h2></div>
      <div className="public-feature-grid">{features.map(({ icon: Icon, title, description }) => <article key={title}><span><Icon size={21} /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>
    <section className="public-google-use">
      <div><p className="eyebrow">GOOGLE API USAGE</p><h2>เหตุผลที่ระบบขอสิทธิ์ Google</h2></div>
      <p>Google Sign-In ใช้ยืนยันตัวตน, Google Sheets ใช้อ่านและอัปเดตไฟล์ที่ผู้ใช้เชื่อมกับ Project และ Google Drive ใช้สร้างโฟลเดอร์และจัดเก็บ Evidence ที่ผู้ใช้อัปโหลดผ่านระบบ ระบบไม่ขายข้อมูล Google และไม่นำข้อมูลไปใช้เพื่อการโฆษณา</p>
    </section>
    <footer className="public-footer"><span>© 2026 QA Result Workspace</span><nav><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><a href="mailto:warawut_pum@truecorp.co.th">Contact</a></nav></footer>
  </main>;
}
