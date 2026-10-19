"use client";
export default function HistoryError({reset}:{reset:()=>void}){return <main className="sprint-snapshot-page"><h1>โหลดข้อมูลย้อนหลังไม่สำเร็จ</h1><p>ระบบจะไม่ใช้ข้อมูลปัจจุบันแทนประวัติ กรุณาลองอีกครั้ง</p><button className="secondary-button" onClick={reset}>ลองใหม่</button></main>;}
