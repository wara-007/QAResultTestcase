"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, Crown, LoaderCircle, MailPlus, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { setAppUserAccess, setSystemOwner } from "@/app/actions";
import type { SystemUser } from "@/lib/types";

export function SystemUsers({ initialUsers, initialError }: { initialUsers: SystemUser[]; initialError: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState(initialError);
  const [email, setEmail] = useState("");
  const [changingId, setChangingId] = useState("");
  const [pending, startTransition] = useTransition();

  function changeOwner(user: SystemUser) {
    if (!user.id) return;
    const userId = user.id;
    const enabled = !user.isSystemOwner;
    const action = enabled ? "ให้สิทธิ์ System Owner" : "ยกเลิกสิทธิ์ System Owner";
    if (!window.confirm(`${action} สำหรับ ${user.email} หรือไม่?`)) return;
    setError("");
    setChangingId(userId);
    startTransition(async () => {
      const result = await setSystemOwner({ userId, enabled });
      if (result.error) setError(result.error);
      else setUsers((current) => current.map((item) => item.id === userId ? { ...item, isSystemOwner: enabled, isAuthorized: enabled || item.isAuthorized } : item));
      setChangingId("");
    });
  }

  function authorize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError("");
    setChangingId(normalizedEmail);
    startTransition(async () => {
      const result = await setAppUserAccess({ email: normalizedEmail, enabled: true });
      if (result.error) setError(result.error);
      else {
        setUsers((current) => current.some((user) => user.email === normalizedEmail)
          ? current.map((user) => user.email === normalizedEmail ? { ...user, isAuthorized: true } : user)
          : [...current, { id: null, email: normalizedEmail, displayName: normalizedEmail.split("@")[0], isAuthorized: true, isSystemOwner: false, lastSignInAt: null }]);
        setEmail("");
      }
      setChangingId("");
    });
  }

  function changeAccess(user: SystemUser) {
    const enabled = !user.isAuthorized;
    if (!enabled && !window.confirm(`ยกเลิกสิทธิ์เข้าใช้งานของ ${user.email} หรือไม่?`)) return;
    setError("");
    setChangingId(user.email);
    startTransition(async () => {
      const result = await setAppUserAccess({ email: user.email, enabled });
      if (result.error) setError(result.error);
      else setUsers((current) => current.map((item) => item.email === user.email ? { ...item, isAuthorized: enabled } : item));
      setChangingId("");
    });
  }

  return <main className="groups-screen">
    <header className="groups-topbar">
      <div className="groups-brand"><span><ShieldCheck size={23} /></span><div><strong>จัดการสิทธิ์ระบบ</strong><small>System access</small></div></div>
      <Link className="secondary-button" href="/groups"><ArrowLeft size={16} />กลับไป Groups</Link>
    </header>
    <section className="groups-content members-content">
      <div className="groups-heading"><div><p className="eyebrow">APPLICATION ACCESS</p><h1>ผู้ใช้งานทั้งหมด</h1><span>อนุมัติอีเมลก่อน Login และกำหนด System Owner สำหรับดูแลระบบ</span></div></div>
      {error && <div className="project-error"><div><strong>ดำเนินการไม่สำเร็จ</strong><span>{error}</span></div></div>}
      <form className="panel app-access-form" onSubmit={authorize}>
        <div><MailPlus size={22} /><div><h2>อนุมัติผู้ใช้ใหม่</h2><p>เพิ่มอีเมล Google ก่อน ผู้ใช้จึงจะเข้า Workspace ได้หลัง Login</p></div></div>
        <div className="app-access-fields"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" /><button className="primary-button" disabled={pending}>{changingId === email.trim().toLowerCase() ? <LoaderCircle className="spin" size={15} /> : <MailPlus size={15} />}อนุมัติอีเมล</button></div>
      </form>
      <section className="panel members-panel system-users-panel">
        <div className="panel-heading"><div><h2>สิทธิ์เข้าใช้งาน</h2><p>{users.filter((user) => user.isAuthorized).length} จาก {users.length} บัญชีได้รับอนุมัติ</p></div><Users size={21} /></div>
        <div className="members-list">{users.map((user) => <article key={user.email}>
          <span className="avatar compact">{user.displayName.slice(0, 2).toUpperCase()}</span>
          <div><strong>{user.displayName}</strong><small>{user.email}{!user.id ? " · รอ Login ครั้งแรก" : ""}</small></div>
          <span className={user.isAuthorized ? "access-approved" : "access-blocked"}>{user.isAuthorized ? <Check size={12} /> : <ShieldOff size={12} />}{user.isAuthorized ? "เข้าใช้งานได้" : "ระงับสิทธิ์"}</span>
          {user.isSystemOwner && <span className="system-owner-badge"><Crown size={13} />System Owner</span>}
          <button type="button" className={user.isAuthorized ? "danger-button" : "secondary-button"} disabled={pending || user.isSystemOwner} onClick={() => changeAccess(user)}>{changingId === user.email && <LoaderCircle className="spin" size={14} />}{user.isAuthorized ? "ระงับสิทธิ์" : "อนุมัติ"}</button>
          <button type="button" className={user.isSystemOwner ? "danger-button" : "secondary-button"} disabled={pending || !user.id} title={user.id ? undefined : "ให้ผู้ใช้ Login ครั้งแรกก่อนกำหนด System Owner"} onClick={() => changeOwner(user)}>
            {changingId === user.id && <LoaderCircle className="spin" size={14} />}{user.isSystemOwner ? "ยกเลิกสิทธิ์" : "ให้สิทธิ์ Owner"}
          </button>
        </article>)}</div>
      </section>
      <p className="system-role-help">สิทธิ์ Admin, QA Lead, QA และ Viewer กำหนดแยกในหน้า “จัดการกลุ่ม” ของแต่ละกลุ่ม</p>
    </section>
  </main>;
}
