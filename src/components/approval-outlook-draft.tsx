"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Copy, Mail, X } from "lucide-react";
import { outlookComposeLink, type ApprovalOutlookDraft } from "@/lib/approval-outlook";

export function ApprovalOutlookDraftDialog({ draft, onClose, flash }: {
  draft: ApprovalOutlookDraft;
  onClose: () => void;
  flash: (message: string) => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const compose = outlookComposeLink(draft);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const elements = dialog.current?.querySelectorAll<HTMLElement>("button, a[href], input, textarea");
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
    <section ref={dialog} className="approval-outlook-dialog" role="dialog" aria-modal="true" aria-labelledby="outlook-draft-title" onKeyDown={handleKeyDown} onMouseDown={event => event.stopPropagation()}>
      <button type="button" className="icon-button close-button" onClick={onClose} aria-label="ปิดร่างอีเมล"><X size={18} /></button>
      <h2 id="outlook-draft-title">เตรียมอีเมลสำหรับ Outlook</h2>
      <p>เว็บยังไม่ได้ส่งอีเมล กรุณาเปิด Outlook เลือก From เป็น <strong>{draft.senderEmail}</strong> แล้วกด Send ด้วยตนเอง</p>
      <p className="approval-outlook-notice" role="status">{compose.bodyIncluded ? "ตรวจผู้รับ หัวข้อ เนื้อหา และลิงก์ Approve ก่อนส่ง" : compose.headersIncluded ? "เนื้อหายาว กรุณาคัดลอกเนื้อหาไปวางใน Outlook หลังเปิดร่าง" : "ข้อมูลอีเมลยาว กรุณาคัดลอก CC หัวข้อ และเนื้อหาไปวางใน Outlook หลังเปิดร่าง"}</p>
      <div className="approval-outlook-fields">
        <label className="text-field"><span>ผู้รับ</span><input readOnly value={draft.recipientEmail} onFocus={event => event.target.select()} /></label>
        {draft.cc.length > 0 && <div className="approval-outlook-copy-field"><label className="text-field"><span>CC</span><input readOnly value={draft.cc.join(", ")} onFocus={event => event.target.select()} /></label><button type="button" className="secondary-button" onClick={() => void copy(draft.cc.join(", "))}><Copy size={15} />คัดลอก CC</button></div>}
        <div className="approval-outlook-copy-field"><label className="text-field"><span>หัวข้อ</span><input readOnly value={draft.subject} onFocus={event => event.target.select()} /></label><button type="button" className="secondary-button" onClick={() => void copy(draft.subject)}><Copy size={15} />คัดลอกหัวข้อ</button></div>
        <label className="text-field"><span>เนื้อหา พร้อมลิงก์ Approve</span><textarea readOnly rows={10} value={draft.body} onFocus={event => event.target.select()} /></label>
        <button type="button" className="secondary-button" onClick={() => void copy(draft.body)}><Copy size={15} />คัดลอกเนื้อหา</button>
      </div>
      <p>หาก Outlook ไม่เปิด ให้ตั้ง Outlook เป็นแอปอีเมลเริ่มต้น หรือคัดลอกข้อมูลด้านบนไปสร้างเมลใน Outlook เอง เว็บจะยังแสดงสถานะรอผู้ใช้ส่งผ่าน Outlook</p>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>ปิด</button><a className="primary-button" href={compose.url}><Mail size={17} />เปิด Outlook เพื่อส่ง</a></div>
    </section>
  </div>;
}
