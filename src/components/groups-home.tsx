"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronRight, ClipboardCheck, Crown, FolderKanban, Layers3, LoaderCircle, LockKeyhole, LogOut, Plus, Users, X } from "lucide-react";
import { createGroup } from "@/app/actions";
import { signOut } from "@/app/auth/actions";
import type { CurrentUser, Group } from "@/lib/types";

export function GroupsHome({ initialGroups, error, currentUser }: { initialGroups: Group[]; error: string; currentUser: CurrentUser | null }) {
  const [groups, setGroups] = useState(initialGroups);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    startTransition(async () => {
      const result = await createGroup({ name, description });
      if (!result.group) return setFormError(result.error ?? "สร้างกลุ่มไม่สำเร็จ");
      setGroups((current) => [...current, result.group]);
      setName("");
      setDescription("");
      setShowCreate(false);
    });
  }

  return (
    <main className="groups-screen">
      <header className="groups-topbar">
        <div className="groups-brand"><span><ClipboardCheck size={23} /></span><div><strong>QA Workspace</strong><small>Test execution</small></div></div>
        {currentUser && <div className="groups-user"><span className="avatar compact">{currentUser.name.slice(0, 2).toUpperCase()}</span><div><strong>{currentUser.name}</strong><small>{currentUser.email}</small></div>{currentUser.isSystemOwner && <Link className="system-users-link" href="/admin/users"><Crown size={15} />จัดการสิทธิ์</Link>}<form action={signOut}><button type="submit"><LogOut size={16} />ออกจากระบบ</button></form></div>}
      </header>

      <section className="groups-content">
        <div className="groups-heading"><div><p className="eyebrow">WORKSPACE</p><h1>{currentUser?.isSystemOwner ? "กลุ่มทั้งหมด" : "กลุ่มของคุณ"}</h1><span>{currentUser?.isSystemOwner ? "คุณเป็น System Owner และเห็นทุกกลุ่มในระบบ" : "เลือกกลุ่มเพื่อดู Projects หรือสร้างกลุ่มใหม่สำหรับทีม QA"}</span></div><button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} />สร้างกลุ่ม</button></div>
        {error ? <div className="project-error"><div><strong>โหลด Groups ไม่สำเร็จ</strong><span>{error}</span></div></div> : groups.length ? (
          <div className="group-grid">{groups.map((group) => {
            const content = <><div className="group-card-top"><span className="group-icon">{group.canAccess ? <Users size={23} /> : <LockKeyhole size={21} />}</span>{group.canAccess && <ChevronRight size={20} />}</div>
              <h2>{group.name}</h2><p>{group.description || "พื้นที่ทำงานสำหรับทีม QA"}</p>
              <div className="group-card-footer">{group.canAccess ? <span><FolderKanban size={15} />{group.projectCount} Projects</span> : <span className="no-group-access"><LockKeyhole size={14} />ยังไม่มีสิทธิ์เข้าถึง</span>}<small>สร้างเมื่อ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(group.createdAt))}</small></div></>;
            return <article className={`group-card-shell${group.canAccess ? "" : " locked"}`} key={group.id}>
              {group.canAccess ? <Link className="group-card" href={`/groups/${group.id}/projects`}>{content}</Link> : <div className="group-card">{content}</div>}
              {group.canManage && <Link className="group-members-link" href={`/groups/${group.id}/members`}><Users size={15} />จัดการกลุ่ม</Link>}
            </article>;
          })}</div>
        ) : <div className="panel groups-empty"><Layers3 size={42} /><h2>ยังไม่มีกลุ่ม</h2><p>สร้างกลุ่มแรกเพื่อรวบรวม Projects และสมาชิกทีม QA</p><button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} />สร้างกลุ่มแรก</button></div>}
      </section>

      {showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}><form className="project-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button close-button" onClick={() => setShowCreate(false)} aria-label="ปิด"><X size={19} /></button>
        <div className="dialog-heading"><div className="dialog-icon"><Users size={23} /></div><div><p className="eyebrow">NEW GROUP</p><h2>สร้างกลุ่ม</h2></div></div>
        <label className="text-field"><span>ชื่อกลุ่ม *</span><input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น Mobile QA Team" /></label>
        <label className="text-field"><span>รายละเอียด</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="ขอบเขตหรือผลิตภัณฑ์ที่ทีมดูแล" /></label>
        {formError && <p className="form-error">{formError}</p>}
        <footer className="dialog-footer"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>ยกเลิก</button><button className="primary-button" disabled={pending}>{pending && <LoaderCircle className="spin" size={17} />}สร้างกลุ่ม</button></footer>
      </form></div>}
    </main>
  );
}
