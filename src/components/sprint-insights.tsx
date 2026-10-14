import Link from 'next/link';
import { Bug, CheckCircle2, ChevronRight, Clock3, Database, TriangleAlert, Users } from 'lucide-react';
import { buildSprintResultActivity } from '@/lib/personal-test-performance';
import { formatReportDate } from '@/lib/date-format';
import type { SprintDashboardData } from '@/lib/sprint-dashboard';

export function SprintAttention({data,groupId}:{data:SprintDashboardData;groupId:string}) {
  const kinds=[{kind:'failed',label:'Failed',description:'เคสที่ผลล่าสุดไม่ผ่าน',icon:TriangleAlert,section:'test-cases'},
    {kind:'unassigned',label:'ยังไม่มอบหมาย QA',description:'Projects ที่ยังไม่มี QA รับผิดชอบ',icon:Users,section:'overview'},
    {kind:'defects',label:'Defects ยังเปิด',description:'Defects ที่ยังไม่ปิด รวม Sheets และเว็บ',icon:Bug,section:'defects'},
    {kind:'approval',label:'รอ PO Approval',description:'คำขอที่ยังรอ PO รีวิว',icon:CheckCircle2,section:'overview'}];
  return <section className="sd-panel sd-attention sprint-attention"><div className="sd-section-heading"><h2><TriangleAlert size={20}/>งานที่ต้องติดตาม</h2></div>{kinds.map(item=>{
    const matches=data.attention.filter(entry=>entry.kind===item.kind);
    const count=matches.reduce((sum,entry)=>sum+entry.count,0);
    return <details key={item.kind}><summary><span className={`sd-attention-icon sd-${item.kind}`}><item.icon size={21}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span><b>{count}</b><ChevronRight size={16}/></summary><div>{matches.map(entry=><Link key={entry.projectId} href={`/groups/${groupId}/projects/${entry.projectId}/${item.section}`}><span>{entry.projectName}</span><strong>{entry.count}</strong><ChevronRight size={15}/></Link>)}{!count && <p className="sd-empty">ไม่มีรายการที่ต้องติดตาม</p>}</div></details>;
  })}</section>;
}

export function SprintRecentActivity({data}:{data:SprintDashboardData}) {
  const activity=buildSprintResultActivity(data.personalPerformance).slice(0,5);
  return <div className="sprint-activity-grid"><section className="sd-panel sprint-recent"><div className="sd-section-heading"><div><h2><Clock3 size={20}/>กิจกรรมผลทดสอบล่าสุด</h2><p>จากผลที่มีวันเวลาบันทึก · ผลร่วมหลายเคสแสดงกิจกรรมเดียว</p></div></div>{activity.map(item=><Link key={item.key} href={item.detailPath}><span className={`sprint-activity-dot status-${item.status.toLowerCase().replaceAll(' ','-')}`}/><span><strong>{item.testerName}</strong> บันทึก {item.caseIds.join(', ')} เป็น <b>{item.status}</b><small>{item.projectName} · {item.source==='web' ? 'เว็บ' : 'Sheets / ข้อมูลเดิม'}</small></span><time>{formatReportDate(item.recordedAt)}</time><ChevronRight size={15}/></Link>)}{!activity.length && <p className="sd-empty">ยังไม่มีผลทดสอบที่ระบุวันเวลาบันทึกใน Sprint นี้</p>}</section>
    <section className="sd-panel sprint-source"><div className="sd-section-heading"><h2><Database size={20}/>แหล่งข้อมูลและการนับ</h2></div><dl><div><dt>เว็บ + Google Sheets</dt><dd>ใช้ข้อมูลที่บันทึกไว้ ไม่เรียก Sheets หรือโหลดรูปซ้ำตอนเปิด Dashboard</dd></div><div><dt>ไม่ระบุผู้ทดสอบ แสดงแยก</dt><dd>ไม่ใช้ชื่อผู้สร้าง Project หรือคนที่นำเข้าแทน EXECUTED BY</dd></div><div><dt>แท็บที่ยังไม่ map ไม่นับรวมเคส</dt><dd>ผลร่วมหลายเคสอาจอ้างอิงชุดหลักฐานเดียวกัน ไม่ใช่การเทสแยกหลายครั้ง</dd></div><div><dt>ประวัติ Sprint</dt><dd>ดูผู้แก้ไขและการย้าย Projects ได้ที่เมนูประวัติ</dd></div></dl></section>
  </div>;
}
