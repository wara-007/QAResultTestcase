"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, Users } from 'lucide-react';
import type { TestCase } from '@/lib/types';
import { buildProjectTeamParticipation } from '@/lib/project-team-participation';

export function ProjectTeamParticipation({ cases, projectHref, loading = false }: { cases: TestCase[]; projectHref: string; loading?: boolean }) {
  const people = useMemo(() => buildProjectTeamParticipation(cases), [cases]);
  return <section className="panel project-team-participation" aria-labelledby="project-team-title">
    <div className="panel-heading"><div><h2 id="project-team-title"><Users size={20} aria-hidden="true" /> การมีส่วนร่วมของทีม</h2><p>ใครช่วยทดสอบเคสไหน และทำ Steps อะไรบ้าง</p></div><span className="sheet-total">{people.length} คน</span></div>
    {loading ? <p className="project-team-note" role="status">กำลังโหลดข้อมูลการทดสอบ…</p> : !people.length ? <div className="empty-state compact-empty"><Users size={24} /><strong>ยังไม่มีข้อมูลผู้ทดสอบ</strong><span>จะแสดงเมื่อมีชื่อผู้ทดสอบใน Test cases หรือผลทดสอบที่โหลดไว้</span></div> : <>
      <div className="project-team-columns" aria-hidden="true"><span>ผู้ทดสอบ</span><span>เคสที่มีส่วนร่วม</span><span>Steps ที่ทดสอบ</span><span>ลักษณะข้อมูล</span></div>
      {people.map(person => <details className="project-team-person" key={person.name}>
        <summary><span className="project-team-name"><ChevronDown size={16} aria-hidden="true" /><span className="avatar compact">{person.name.slice(0, 2).toUpperCase()}</span><strong>{person.name}</strong></span><span><b>{person.cases.length}</b><small> เคส</small></span><span><b>{person.stepCount || '—'}</b><small>{person.stepCount ? ' Steps' : ''}</small></span><span className="project-team-source">{person.stepCount ? 'มีรายละเอียด Step' : 'ผลระดับ Test case'}{person.caseOnlyCount > 0 && person.stepCount > 0 && <small>อีก {person.caseOnlyCount} เคสไม่มีรายละเอียด Step</small>}</span></summary>
        <div className="project-team-case-list">{person.cases.map(item => <div className="project-team-case" key={item.id}><Link prefetch={false} href={`${projectHref}/test-cases/${encodeURIComponent(item.id)}`}><strong>{item.label}</strong> · {item.name}</Link>{item.steps.length ? <ul>{item.steps.map(step => <li key={step.id}><span>{step.name}</span><span className="project-team-step-status">{step.status}</span></li>)}</ul> : <p>มีผลระดับ Test case · ไม่มีรายละเอียด Step ที่ระบุผู้ทดสอบ</p>}</div>)}</div>
      </details>)}
      <p className="project-team-note">สรุปจากข้อมูลที่โหลดไว้ · เคสเดียวอาจมีหลายคนร่วมทดสอบ จึงไม่ควรบวกจำนวนเคสรายคนเป็นยอดรวม Project · นับแต่ละ Step ต่อคนครั้งเดียว ใช้ผลล่าสุดที่บันทึก ไม่รวมจำนวนครั้งที่ทดสอบซ้ำ</p>
    </>}
  </section>;
}
