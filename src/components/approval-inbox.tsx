import Link from "next/link";
import { CheckCircle2, ChevronRight, ClipboardCheck, Clock3, LogOut, RotateCcw } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import type { ApprovalInboxItem } from "@/lib/approvals-server";

const labels = { pending: "รออนุมัติ", approved: "Approved", changes_requested: "ขอให้แก้ไข", revoked: "ยกเลิกแล้ว" } as const;

export function ApprovalInbox({ approvals, user }: { approvals: ApprovalInboxItem[]; user: { email: string; name: string } }) {
  const pending = approvals.filter((item) => item.status === "pending").length;
  const approved = approvals.filter((item) => item.status === "approved").length;
  return <div className="approval-inbox-page">
    <header className="review-topbar"><div><span><ClipboardCheck size={21} /></span><div><strong>QA Result Workspace</strong><small>PO Portal</small></div></div><div className="approval-inbox-user"><span><strong>{user.name}</strong><small>{user.email}</small></span><form action={signOut}><button type="submit"><LogOut size={15} />ออกจากระบบ</button></form></div></header>
    <main className="approval-inbox-container">
      <section className="approval-inbox-heading"><div><p className="eyebrow">PO APPROVAL</p><h1>รายการรอตรวจสอบ</h1><p>คำขอทั้งหมดที่ QA ส่งมายังอีเมลของคุณ</p></div><div><article><Clock3 size={20} /><span>รออนุมัติ<strong>{pending}</strong></span></article><article><CheckCircle2 size={20} /><span>Approved<strong>{approved}</strong></span></article></div></section>
      <section className="approval-inbox-list"><header><div><h2>Approval requests</h2><p>ทั้งหมด {approvals.length} รายการ</p></div></header>
        {approvals.length ? <div>{approvals.map((item) => <Link href={`/approvals/${item.id}`} key={item.id} className="approval-inbox-item"><div className="approval-project-mark"><ClipboardCheck size={19} /></div><div className="approval-inbox-copy"><strong>{item.projectName}</strong><span>{[item.environment, item.sprintNo].filter(Boolean).join(" · ") || "ไม่ระบุ Environment"}</span><small>ส่งโดย {item.requestedByName || "QA Team"} · {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.requestedAt))}</small></div><span className={`approval-inbox-status ${item.status}`}>{labels[item.status]}</span><ChevronRight size={18} /></Link>)}</div> : <div className="approval-inbox-empty"><RotateCcw size={30} /><h2>ยังไม่มีรายการส่งมาให้อนุมัติ</h2><p>เมื่อ QA ส่งคำขอไปยัง {user.email} รายการจะแสดงที่หน้านี้</p></div>}
      </section>
    </main>
  </div>;
}
