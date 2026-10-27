import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleAlert, ClipboardCheck, FileArchive, FolderKanban, History, LayoutDashboard, Settings, Users } from 'lucide-react';

type Props = {
  backHref: string;
  backLabel?: string;
  onNavigate?: () => void;
} & ({
  scope: 'sprint';
  sprintName: string;
  sprintHref: string;
  activePage: 'overview' | 'projects' | 'team' | 'history';
} | {
  scope: 'project';
  projectName: string;
  projectHref: string;
  activePage: 'overview' | 'test-cases' | 'defects' | 'files' | 'settings';
  projectSwitcher?: ReactNode;
  caseCount?: number | string;
  defectCount?: number;
});

export function WorkspaceSidebarNavigation(props: Props) {
  const items = props.scope === 'sprint' ? [
    { page: 'overview', label: 'ภาพรวม Sprint', href: props.sprintHref, icon: LayoutDashboard },
    { page: 'projects', label: 'รายการ Projects', href: `${props.sprintHref}/projects`, icon: FolderKanban },
    { page: 'team', label: 'ทีมใน Sprint', href: `${props.sprintHref}?view=team`, icon: Users },
    { page: 'history', label: 'ประวัติ Sprint', href: `${props.sprintHref}?view=history`, icon: History },
  ] : [
    { page: 'overview', label: 'ภาพรวม Project', href: `${props.projectHref}/overview`, icon: LayoutDashboard },
    { page: 'test-cases', label: 'Test cases', href: `${props.projectHref}/test-cases`, icon: ClipboardCheck, count: props.caseCount },
    { page: 'defects', label: 'Defects', href: `${props.projectHref}/defects`, icon: CircleAlert, count: props.defectCount },
    { page: 'files', label: 'เอกสาร / ไฟล์', href: `${props.projectHref}/files`, icon: FileArchive },
    { page: 'settings', label: 'ตั้งค่า Project', href: `${props.projectHref}/settings`, icon: Settings },
  ];

  return <nav className="workspace-sidebar-nav" aria-label={props.scope === 'sprint' ? 'เมนู Sprint' : 'เมนู Project'}>
    <Link className="workspace-sidebar-back" href={props.backHref} onClick={props.onNavigate}>
      <ArrowLeft size={18} aria-hidden="true" />
      <span>{props.backLabel ?? (props.scope === 'sprint' ? 'กลับไปรายการ Sprints' : 'กลับไป Sprint')}</span>
    </Link>
    <div className="workspace-sidebar-context">
      <p className="workspace-sidebar-heading">{props.scope === 'sprint' ? 'SPRINT' : 'PROJECT'}</p>
      {props.scope === 'project' && props.projectSwitcher ? props.projectSwitcher : <strong>{props.scope === 'sprint' ? props.sprintName : props.projectName}</strong>}
    </div>
    <div className="workspace-sidebar-links">{items.map(item => {
      const Icon = item.icon;
      const current = props.activePage === item.page;
      return <Link key={item.page} className={current ? 'active' : undefined} aria-current={current ? 'page' : undefined} href={item.href} onClick={props.onNavigate}>
        <Icon size={19} aria-hidden="true" /><span>{item.label}</span>
        {'count' in item && item.count !== undefined && <span className="workspace-sidebar-count">{item.count}</span>}
      </Link>;
    })}</div>
  </nav>;
}
