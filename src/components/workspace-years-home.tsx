"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight, ClipboardCheck, Crown, LogOut } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { groupsForYearHref, parseWorkspaceYear } from '@/lib/year-navigation';
import type { CurrentUser } from '@/lib/types';

export function WorkspaceYearsHome({years,currentYear,currentUser,error}:{years:number[];currentYear:number;currentUser:CurrentUser|null;error:string}) {
  const router=useRouter();
  const [year,setYear]=useState(String(currentYear));
  const [validation,setValidation]=useState('');
  function choose(event:React.FormEvent) {
    event.preventDefault();
    const selected=parseWorkspaceYear(year);
    if(!selected) return setValidation('ระบุปี ค.ศ. ระหว่าง 2000–2200');
    router.push(groupsForYearHref(selected));
  }
  return <main className="groups-screen">
    <header className="groups-topbar"><Link className="groups-brand" href="/groups"><span><ClipboardCheck size={23}/></span><div><strong>QA Workspace</strong><small>Test execution</small></div></Link>{currentUser && <div className="groups-user"><div><strong>{currentUser.name}</strong><small>{currentUser.email}</small></div>{currentUser.isSystemOwner && <Link className="system-users-link" href="/admin/users"><Crown size={15}/>จัดการสิทธิ์</Link>}<form action={signOut}><button><LogOut size={16}/>ออกจากระบบ</button></form></div>}</header>
    <section className="groups-content planning-content"><div className="groups-heading"><div><p className="eyebrow">WORKSPACE</p><h1>เลือกปี</h1><span>เลือกปี → กลุ่ม → Sprint → Projects</span></div></div>
      {error && <div className="project-error"><strong>โหลดรายการปีไม่สำเร็จ</strong><p>{error}</p></div>}
      <div className="planning-list">{years.map(value=><Link key={value} className="planning-row" href={groupsForYearHref(value)}><CalendarDays size={24}/><strong>{value}</strong><span>{value===currentYear ? 'ปีปัจจุบัน' : 'ปีที่มีข้อมูลใน Workspace'}</span><ChevronRight size={18}/></Link>)}</div>
      <form className="panel workspace-year-picker" onSubmit={choose}><label className="text-field"><span>เลือกปีอื่น (ค.ศ.)</span><input type="number" min={2000} max={2200} required value={year} onChange={event=>{setYear(event.target.value);setValidation('');}}/></label><button className="primary-button">ดูกลุ่มในปีนี้<ChevronRight size={16}/></button>{validation && <p className="form-error">{validation}</p>}<p>แสดงทุกกลุ่ม แม้ยังไม่มี Sprint ในปีที่เลือก การเลือกปีไม่สร้างหรือเปลี่ยนข้อมูล</p></form>
    </section>
  </main>;
}
