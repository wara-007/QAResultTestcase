"use client";

import { useId, type KeyboardEvent } from "react";
import { CircleAlert } from "lucide-react";
import { websiteDeliveryAvailable, type ApprovalDeliveryMode } from "@/lib/approval-manual";
import type { MailProvider } from "@/lib/mail-provider";

export function ApprovalDeliveryModePicker({ value, provider, connection, disabled = false, idPrefix, onChange }: {
  value: ApprovalDeliveryMode;
  provider: MailProvider | null;
  connection: {configured: boolean; connected: boolean} | null;
  disabled?: boolean;
  idPrefix?: string;
  onChange: (mode: ApprovalDeliveryMode) => void;
}) {
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  const available = websiteDeliveryAvailable(provider, connection);
  const modes: ApprovalDeliveryMode[] = ["oauth", "manual"];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, mode: ApprovalDeliveryMode) {
    if (disabled || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - modes.indexOf(mode);
    onChange(modes[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return <div className="approval-delivery-mode-picker">
    <div role="tablist" aria-label="โหมดส่งคำขอ Approve" className="approval-delivery-tabs">
      {modes.map(mode => <button key={mode} id={`${prefix}-tab-${mode}`} type="button" role="tab" aria-selected={value === mode} aria-controls={`${prefix}-panel-${mode}`} tabIndex={value === mode ? 0 : -1} disabled={disabled} onClick={() => onChange(mode)} onKeyDown={event => handleKeyDown(event, mode)}>{mode === "oauth" ? "ส่งอีเมลจากเว็บ" : "คัดลอกไปส่งเอง"}</button>)}
    </div>
    <p className="approval-delivery-help">{value === "manual" ? (!available && provider ? "บัญชีนี้ยังไม่มีสิทธิ์ส่งผ่านเว็บ คัดลอกข้อมูลไปส่งเอง แล้วกลับมายืนยันการส่ง" : "คัดลอกข้อมูลไปส่งเอง แล้วกลับมายืนยันการส่ง") : !provider ? "กรุณาระบุอีเมลผู้ส่งให้ถูกต้อง" : !available ? "บัญชีนี้ยังไม่มีสิทธิ์ส่งผ่านเว็บ เปลี่ยนอีเมลผู้ส่งหรือเลือกแท็บคัดลอกไปส่งเองได้" : "ส่งจากบัญชีที่เชื่อมสิทธิ์ พร้อมบันทึกผลตอบรับจากผู้ให้บริการ"}</p>
    {value === "oauth" && provider === "gmail" && <aside className="approval-gmail-notice" role="note" aria-labelledby={`${prefix}-gmail-notice`}>
      <CircleAlert size={19} aria-hidden="true" />
      <div><strong id={`${prefix}-gmail-notice`}>อีเมลจาก Gmail อาจเข้าโฟลเดอร์ขยะ (Junk/Spam)</strong>
        <p>ระบบกรองของผู้รับอาจจัดเมลจากภายนอกองค์กรเป็นเมลขยะ ตามนโยบายบริษัท ความน่าเชื่อถือของผู้ส่ง หรือผลตรวจสอบตัวตนอีเมล สาเหตุจริงต้องตรวจรายละเอียดเมลที่ฝั่งผู้รับ</p>
        <p>หาก PO ไม่พบอีเมล ให้ตรวจ Junk/Spam และกด Not junk เมื่อยืนยันว่าเป็นเมลจากคุณ หรือเพิ่มอีเมลผู้ส่งเป็น Safe Sender</p>
        <a href="https://learn.microsoft.com/en-us/defender-office-365/anti-spam-protection-faq" target="_blank" rel="noreferrer">ดูแนวทาง Microsoft</a>
      </div>
    </aside>}
  </div>;
}
