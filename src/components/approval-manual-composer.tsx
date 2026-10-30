"use client";

import { Copy, LoaderCircle } from "lucide-react";

export function ApprovalManualComposer({projectName, body, recipientEmail, disabled, onBodyChange, onRecipientChange, onCopyBody, copyBodyDisabled, preparing, flash}: {
  projectName: string;
  body: string;
  recipientEmail: string;
  disabled: boolean;
  onBodyChange: (value: string) => void;
  onRecipientChange: (value: string) => void;
  onCopyBody: () => void;
  copyBodyDisabled: boolean;
  preparing: boolean;
  flash: (message: string) => void;
}) {
  async function copyProjectName() {
    try { await navigator.clipboard.writeText(projectName); flash("คัดลอกชื่อโปรเจกต์แล้ว"); }
    catch { flash("คัดลอกอัตโนมัติไม่ได้ กรุณาคลิกช่องชื่อโปรเจกต์แล้วคัดลอกด้วยตนเอง"); }
  }
  return <>
    <div className="approval-outlook-copy-field approval-wide-field"><label className="text-field"><span>ชื่อโปรเจกต์</span><input readOnly value={projectName} onFocus={event => event.target.select()} /></label><button type="button" className="secondary-button" disabled={disabled} onClick={() => void copyProjectName()}><Copy size={15} />คัดลอกชื่อโปรเจกต์</button></div>
    <label className="text-field approval-wide-field"><span>เนื้อหาอีเมล (แก้ไขได้)</span><textarea rows={9} value={body} maxLength={50000} disabled={disabled} onChange={event => onBodyChange(event.target.value)} /></label>

    <section className="approval-manual-settings approval-wide-field" aria-label="ตั้งค่าลิงก์ Approve">
      <h3>ตั้งค่าลิงก์ Approve · {recipientEmail.trim() || "ยังไม่ได้ระบุอีเมล PO"}</h3>
      <p>อีเมล PO ใช้กำหนดสิทธิ์เปิดลิงก์ Approve ผู้ใช้ต้องส่งเมลเอง เว็บไม่ได้ส่งอัตโนมัติ</p>
      <label className="text-field"><span>อีเมล PO ผู้มีสิทธิ์รีวิว *</span><input type="email" value={recipientEmail} disabled={disabled} onChange={event => onRecipientChange(event.target.value)} placeholder="po@company.com" /></label>
    </section>
    <div className="approval-manual-copy-actions approval-wide-field"><button type="button" className="primary-button" disabled={disabled || copyBodyDisabled} onClick={onCopyBody}>{preparing ? <LoaderCircle className="spin" size={17} /> : <Copy size={17} />}{preparing ? "กำลังเตรียมเนื้อหา…" : "คัดลอกเนื้อหาและลิงก์ Approve"}</button><small>ระบบจะเตรียมลิงก์ Approve ก่อนคัดลอก แล้วเปิดร่างให้ตรวจและยืนยันหลังส่งจริง</small></div>
  </>;
}
