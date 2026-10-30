"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Copy, X } from "lucide-react";
import type { ManualApprovalDelivery } from "@/lib/approval-manual";
import { formatFlexibleDate } from "@/lib/date-format";

export function ApprovalManualDialog({ delivery, projectName: fallbackProjectName, onClose, onConfirm, confirming, flash }: {
  delivery: ManualApprovalDelivery;
  projectName?: string;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
  flash: (message: string) => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const draft = delivery.draft;
  const projectName = draft.projectName ?? fallbackProjectName ?? draft.subject;
  const confirmed = Boolean(delivery.confirmedAt);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const elements = dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea");
    if (!elements?.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); flash("คัดลอกแล้ว"); }
    catch { flash("คัดลอกอัตโนมัติไม่ได้ กรุณาคลิกช่องข้อความแล้วคัดลอกด้วยตนเอง"); }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section ref={dialog} className="approval-outlook-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-draft-title" onKeyDown={handleKeyDown} onMouseDown={event => event.stopPropagation()}>
      <button type="button" className="icon-button close-button" onClick={onClose} aria-label="ปิดร่างอีเมล"><X size={18} /></button>
      <h2 id="manual-draft-title">คัดลอกอีเมลไปส่งเอง</h2>
      <p>คัดลอกชื่อโปรเจกต์กับเนื้อหาไปส่งเอง แล้วกลับมายืนยันการส่ง เว็บไม่ได้ส่งอีเมลให้อัตโนมัติ</p>
      <p className="approval-outlook-notice" role="status">{confirmed ? `ผู้ใช้ยืนยันว่าส่งแล้ว · ${delivery.confirmedByName} · ${formatFlexibleDate(delivery.confirmedAt)}` : "เตรียมแล้ว · ยังไม่ยืนยันการส่ง"}</p>
      <div className="approval-outlook-fields">
        <div className="approval-outlook-copy-field"><label className="text-field"><span>ชื่อโปรเจกต์</span><input readOnly value={projectName} onFocus={event => event.target.select()} /></label><button type="button" className="secondary-button" onClick={() => void copy(projectName)}><Copy size={15} />คัดลอกชื่อโปรเจกต์</button></div>
        <label className="text-field"><span>เนื้อหา พร้อมลิงก์ Approve</span><textarea readOnly rows={7} value={draft.body} onFocus={event => event.target.select()} /></label>
        <button type="button" className="secondary-button" onClick={() => void copy(draft.body)}><Copy size={15} />คัดลอกเนื้อหาและลิงก์ Approve</button>
      </div>
      <p>กดหลังจากส่งอีเมลจริงแล้วเท่านั้น การยืนยันนี้บันทึกโดยผู้ใช้ ระบบไม่ได้ตรวจสอบการนำส่งจริง และผล Approved ต้องมาจาก PO</p>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>ปิด</button><button type="button" className="primary-button" disabled={confirming || confirmed} onClick={onConfirm}>{confirmed ? "บันทึกการส่งแล้ว" : confirming ? "กำลังบันทึก…" : "ยืนยันว่าส่งคำขอ Approve แล้ว"}</button></div>
    </section>
  </div>;
}
