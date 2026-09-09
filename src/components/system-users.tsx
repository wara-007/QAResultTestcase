"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Crown, LoaderCircle, ShieldCheck, Users } from "lucide-react";
import { setSystemOwner } from "@/app/actions";
import type { SystemUser } from "@/lib/types";

export function SystemUsers({ initialUsers, initialError }: { initialUsers: SystemUser[]; initialError: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState(initialError);
  const [changingId, setChangingId] = useState("");
  const [pending, startTransition] = useTransition();

  function changeOwner(user: SystemUser) {
    const enabled = !user.isSystemOwner;
    const action = enabled ? "ให้สิทธิ์ System Owner" : "ยกเลิกสิทธิ์ System Owner";
    if (!window.confirm(`${action} สำหรับ ${user.email} หรือไม่?`)) return;
    setError("");
    setChangingId(user.id);
    startTransition(async () => {
      const result = await setSystemOwner({ userId: user.id, enabled });
      if (result.error) setError(result.error);
      else setUsers((current) => current.map((item) => item.id === user.id ? { ...item, isSystemOwner: enabled } : item));
      setChangingId("");
    });
  }

  return <main className="groups-screen">
    <header className="groups-topbar">
      <div className="groups-brand"><span><ShieldCheck size={23} /></span><div><strong>จัดการสิทธิ์ระบบ</strong><small>System access</small></div></div>
      <Link className="secondary-button" href="/groups"><ArrowLeft size={16} />กลับไป Groups</Link>
    </header>
    <section className="groups-content members-content">
      <div className="groups-heading"><div><p className="eyebrow">SYSTEM OWNERS</p><h1>ผู้ใช้งานทั้งหมด</h1><span>System Owner เห็นและจัดการทุกกลุ่ม ทุก Project และสิทธิ์ผู้ใช้ได้</span></div></div>
      {error && <div className="project-error"><div><strong>ดำเนินการไม่สำเร็จ</strong><span>{error}</span></div></div>}
      <section className="panel members-panel system-users-panel">
        <div className="panel-heading"><div><h2>บัญชีที่เคย Login</h2><p>{users.length} บัญชี</p></div><Users size={21} /></div>
        <div className="members-list">{users.map((user) => <article key={user.id}>
          <span className="avatar compact">{user.displayName.slice(0, 2).toUpperCase()}</span>
          <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
          {user.isSystemOwner && <span className="system-owner-badge"><Crown size={13} />System Owner</span>}
          <button type="button" className={user.isSystemOwner ? "danger-button" : "secondary-button"} disabled={pending} onClick={() => changeOwner(user)}>
            {changingId === user.id && <LoaderCircle className="spin" size={14} />}{user.isSystemOwner ? "ยกเลิกสิทธิ์" : "ให้สิทธิ์ Owner"}
          </button>
        </article>)}</div>
      </section>
      <p className="system-role-help">สิทธิ์ Admin, QA Lead, QA และ Viewer กำหนดแยกในหน้า “จัดการกลุ่ม” ของแต่ละกลุ่ม</p>
    </section>
  </main>;
}
