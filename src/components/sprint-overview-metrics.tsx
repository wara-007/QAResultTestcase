import { CheckCircle2, ListChecks, Clock3, CircleX, SkipForward, CircleDashed, Table2, ChevronDown } from 'lucide-react';
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
  const metrics = [
    {label:'Test cases',key:'totalCases',icon:ListChecks,tone:'total'},
    {label:'Pass',key:'pass',icon:CheckCircle2,tone:'pass'},
    {label:'Failed',key:'failed',icon:CircleX,tone:'failed'},
    {label:'กำลังทดสอบ',key:'inProgress',icon:Clock3,tone:'in-progress'},
    {label:'Skip',key:'skip',icon:SkipForward,tone:'skip'},
    {label:'ยังไม่เริ่ม',key:'notStart',icon:CircleDashed,tone:'not-start'},
  ] as const;
  const projectsById = new Map(data.projects.map(project => [project.id, project]));
  return <>
    <section className={showSummary ? 'sd-panel sprint-overview-summary' : undefined} aria-label="ภาพรวม Sprint">
    {showSummary && <header className="sd-section-heading"><div><h2>สรุปผลทดสอบ</h2><p>ภาพรวมผลทดสอบทั้งหมดใน Sprint</p></div><span className="sprint-overview-project-count">{summary.projects} Projects</span></header>}
    <div className="sd-metrics sprint-report-metrics">{metrics.map(metric=><article key={metric.key} className={`sprint-metric-${metric.tone}`}><span className="sd-metric-icon"><metric.icon size={23}/></span><div><span>{metric.label}</span><strong>{unknown?'—':summary[metric.key]}</strong></div></article>)}</div>
    {showSummary && <div className="sprint-summary-line"><span>{summary.projects} Projects</span><span>{missing?`รวมเฉพาะ ${available} / ${summary.projects} Projects · ยังไม่มียอดสรุป ${missing} Projects · เปิด Project เพื่ออัปเดต`:`ดำเนินการแล้ว ${summary.progress}% · รวม Skip`}</span>{!missing && <span>Defects ปิดแล้ว {summary.closedDefects}/{summary.totalDefects}</span>}</div>}
    {showSummary && <details className="sprint-project-breakdown">
      <summary><Table2 size={18} aria-hidden="true"/><strong>ผลทดสอบแยกราย Project</strong><span className="sprint-breakdown-count">{summary.projects} Projects</span><span className="sprint-breakdown-toggle"><span className="sprint-breakdown-show">ดูรายละเอียด</span><span className="sprint-breakdown-hide">ซ่อนรายละเอียด</span></span><ChevronDown className="sprint-breakdown-chevron" size={18} aria-hidden="true"/></summary>
      <div className="sd-table-scroll" role="region" aria-label="ผลทดสอบแยกราย Project" tabIndex={0}><table>
        <thead><tr><th scope="col">Project</th>{metrics.map(metric=><th key={metric.key} scope="col">{metric.label}</th>)}</tr></thead>
        <tbody>{data.entries.map(entry=>{
          const counts=entry.kind==='continued' ? entry.historical?.counts : projectsById.get(entry.projectId)?.counts;
          const rowUnknown=!counts || (entry.kind==='current' && data.summaryPending?.includes(entry.projectId));
          return <tr key={entry.projectId}><th scope="row">{entry.name}{entry.kind==='continued' && <small>ส่งต่อแล้ว · ยอด ณ วันที่ส่งต่อ</small>}{rowUnknown && <small>ยังไม่มียอดสรุป · เปิด Project เพื่ออัปเดต</small>}</th>{metrics.map(metric=><td key={metric.key} className={`sprint-result-${metric.tone}${!rowUnknown && counts?.[metric.key]===0 ? ' sprint-result-zero' : ''}`}>{rowUnknown?'—':counts![metric.key]}</td>)}</tr>;
        })}</tbody>
        <tfoot><tr><th scope="row">{missing ? 'รวมเฉพาะยอดที่มีข้อมูล' : 'รวมทั้ง Sprint'}</th>{metrics.map(metric=><td key={metric.key} className={`sprint-result-${metric.tone}`}>{unknown?'—':summary[metric.key]}</td>)}</tr></tfoot>
      </table></div>
      {!data.entries.length && <p className="sd-empty">ยังไม่มี Project ใน Sprint</p>}
    </details>}
    </section>
    {showSummary && pendingProjects.length > 0 && <section className="sd-panel sprint-pending-projects" aria-label="Projects ที่ยังไม่ได้เริ่ม">
      <h2>Projects ที่ยังไม่ได้เริ่ม</h2>
      <ul>{pendingProjects.map(project => <li key={project.id}><span>{project.name}</span><span className="sprint-pending-status">ยังไม่ได้เริ่ม</span></li>)}</ul>
    </section>}
  </>;
}
