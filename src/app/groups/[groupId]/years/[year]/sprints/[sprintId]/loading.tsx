import { LoaderCircle } from 'lucide-react';

export default function SprintLoading() {
  return <main className="groups-screen"><section className="panel" role="status" aria-live="polite" style={{margin:'2rem',padding:'2rem'}}>
    <LoaderCircle className="spin" size={24} aria-hidden="true" />
    <h1>กำลังโหลดภาพรวม Sprint</h1>
    <p>กำลังอ่าน Projects และสรุปผลทดสอบ</p>
  </section></main>;
}
