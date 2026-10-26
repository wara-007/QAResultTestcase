import { AlertTriangle, RefreshCw } from 'lucide-react';
import { accessRetryDestination } from '../lib/access-flow';
export function AccessCheckUnavailable({next}:{next:string}) {
  return <main className="auth-screen"><section className="auth-card access-pending-card">
    <div className="auth-icon pending"><AlertTriangle size={25}/></div>
    <h1>ตรวจสอบสิทธิ์ไม่สำเร็จ</h1>
    <p role="alert">ระบบเชื่อมต่อฐานข้อมูลไม่ได้ชั่วคราว จึงยังยืนยันสิทธิ์ของบัญชีไม่ได้ กรุณาลองอีกครั้ง</p>
    <a className="primary-button access-refresh-button" href={accessRetryDestination(next)}><RefreshCw size={16}/>ลองอีกครั้ง</a>
  </section></main>;
}
