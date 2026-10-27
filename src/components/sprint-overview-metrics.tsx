import { CheckCircle2, ListChecks, Clock3, CircleX, SkipForward, CircleDashed } from 'lucide-react';
import type { SprintDashboardData } from '@/lib/sprint-dashboard';

export function SprintOverviewMetrics({data, showSummary}: {data: SprintDashboardData; showSummary: boolean}) {
  const summary = data.summary;
  const missing = data.summaryPending?.length ?? 0;
  const pendingProjects = data.projects.filter(project =>
    data.summaryPending?.includes(project.id) ||
    project.counts.pass + project.counts.failed + project.counts.skip + project.counts.inProgress === 0
  );
  const available = summary.projects - missing;
  const unknown = missing > 0 && available === 0;
  return <>
    <section className="sd-metrics sprint-report-metrics" aria-label="ภาพรวม Sprint">{[{label:'Test cases',value:summary.totalCases,icon:ListChecks,tone:'total'},{label:'Pass',value:summary.pass,icon:CheckCircle2,tone:'pass'},{label:'Failed',value:summary.failed,icon:CircleX,tone:'failed'},{label:'กำลังทดสอบ',value:summary.inProgress,icon:Clock3,tone:'in-progress'},{label:'Skip',value:summary.skip,icon:SkipForward,tone:'skip'},{label:'ยังไม่เริ่ม',value:summary.notStart,icon:CircleDashed,tone:'not-start'}].map(metric=><article key={metric.label} className={`sprint-metric-${metric.tone}`}><span className="sd-metric-icon"><metric.icon size={23}/></span><div><span>{metric.label}</span><strong>{unknown?'—':metric.value}</strong></div></article>)}</section>
    {showSummary && <div className="sprint-summary-line"><span>{summary.projects} Projects</span><span>{missing?`รวมเฉพาะ ${available} / ${summary.projects} Projects · ยังไม่มียอดสรุป ${missing} Projects · เปิด Project เพื่ออัปเดต`:`ดำเนินการแล้ว ${summary.progress}% · รวม Skip`}</span>{!missing && <span>Defects ปิดแล้ว {summary.closedDefects}/{summary.totalDefects}</span>}</div>}
    {showSummary && pendingProjects.length > 0 && <section className="sd-panel sprint-pending-projects" aria-label="Projects ที่ยังไม่ได้เริ่ม">
      <h2>Projects ที่ยังไม่ได้เริ่ม</h2>
      <ul>{pendingProjects.map(project => <li key={project.id}><span>{project.name}</span><span className="sprint-pending-status">ยังไม่ได้เริ่ม</span></li>)}</ul>
    </section>}
  </>;
}
