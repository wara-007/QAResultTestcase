"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, LoaderCircle, MailPlus, ShieldCheck, Trash2, Users } from "lucide-react";
import { inviteGroupMember, removeGroupMember } from "@/app/actions";
import type { GroupMember } from "@/lib/types";

const roleLabels = { admin: "Admin", qa_lead: "QA Lead", qa: "QA", viewer: "Viewer" } as const;

export function GroupMembers({ groupId, groupName, initialMembers, initialError }: { groupId: string; groupName: string; initialMembers: GroupMember[]; initialError: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GroupMember["role"]>("qa");
  const [error, setError] = useState(initialError);
  const [pending, startTransition] = useTransition();

  function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    startTransition(async () => {
      const result = await inviteGroupMember({ groupId, email, role });
      if (result.error) return setError(result.error);
      const normalizedEmail = email.trim().toLowerCase();
      setMembers((current) => [...current.filter((member) => member.email !== normalizedEmail), { memberId: "", email: normalizedEmail, displayName: normalizedEmail.split("@")[0], role, pending: true, isOwner: false }]);
      setEmail("");
    });
  }

  function remove(member: GroupMember) {
    if (!window.confirm(`นำ ${member.email} ออกจากกลุ่มหรือไม่?`)) return;
    setError("");
    startTransition(async () => {
      const result = await removeGroupMember({ groupId, memberId: member.memberId, email: member.email });
      if (result.error) return setError(result.error);
      setMembers((current) => current.filter((item) => item.email !== member.email));
    });
  }

  return <main className="groups-screen"><header className="groups-topbar"><div className="groups-brand"><span><ShieldCheck size={23} /></span><div><strong>สมาชิกกลุ่ม</strong><small>{groupName}</small></div></div><Link className="secondary-button" href="/groups"><ArrowLeft size={16} />กลับไป Groups</Link></header>
    <section className="groups-content members-content"><div className="groups-heading"><div><p className="eyebrow">GROUP ACCESS</p><h1>{groupName}</h1><span>สมาชิกในกลุ่มจะเห็น Projects ทั้งหมดตามสิทธิ์ที่กำหนด</span></div><Link className="secondary-button" href={`/groups/${groupId}/projects`}>ดู Projects</Link></div>
      <form className="panel member-invite-form" onSubmit={invite}><div><MailPlus size={22} /><div><h2>เพิ่มสมาชิกด้วยอีเมล Google</h2><p>หากยังไม่เคย Login ระบบจะเพิ่มสิทธิ์ให้อัตโนมัติเมื่อ Login ครั้งแรก</p></div></div><div className="member-invite-fields"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="qa@example.com" /><select value={role} onChange={(event) => setRole(event.target.value as GroupMember["role"])}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="primary-button" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <MailPlus size={16} />}เพิ่มสมาชิก</button></div>{error && <p className="form-error">{error}</p>}</form>
      <section className="panel members-panel"><div className="panel-heading"><div><h2>สมาชิก</h2><p>{members.length} บัญชีและคำเชิญ</p></div><Users size={21} /></div><div className="members-list">{members.map((member) => <article key={`${member.memberId}-${member.email}`}><span className="avatar compact">{member.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{member.displayName}</strong><small>{member.email}</small></div><span className="member-role">{roleLabels[member.role]}</span>{member.pending && <span className="member-pending">รอ Login</span>}{member.isOwner ? <span className="member-owner">Owner</span> : <button type="button" className="danger-button" disabled={pending} onClick={() => remove(member)}><Trash2 size={14} />นำออก</button>}</article>)}</div></section>
    </section></main>;
}
