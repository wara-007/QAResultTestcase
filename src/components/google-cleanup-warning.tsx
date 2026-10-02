"use client";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function GoogleCleanupWarning() {
  const params=useSearchParams();
  const pathname=usePathname();
  const router=useRouter();
  if(params.get('googleCleanupWarning')!=='1') return null;
  return <div className="modal-backdrop"><section className="project-dialog" role="alertdialog" aria-modal="true" aria-labelledby="project-delete-warning"><h2 id="project-delete-warning">ลบ Project แล้ว แต่มีคำเตือน</h2><p>ไม่สามารถตรวจหรือลบรูปใน Google ได้ครบ รูปที่เหลือยังอยู่ใน Google Drive กรุณาลบเองภายหลัง Google Sheets ไม่ถูกลบ</p><footer className="dialog-footer"><button type="button" className="primary-button" onClick={()=>{const next=new URLSearchParams(params.toString());next.delete('googleCleanupWarning');router.replace(`${pathname}${next.size ? `?${next}` : ''}`);}}>รับทราบ</button></footer></section></div>;
}
