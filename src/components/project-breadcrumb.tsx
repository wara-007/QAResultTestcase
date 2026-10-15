"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function ProjectBreadcrumb({ year, groupId, sprintHref, sprintName, projectsHref, projectName }: {
  year?: number; groupId: string; sprintHref?: string; sprintName?: string;
  projectsHref: string; projectName: string;
}) {
  const ancestors = [
    { href: "/groups", label: "เลือกปี" },
    ...(year ? [
      { href: `/groups?year=${year}`, label: "Groups" },
      { href: `/groups/${groupId}/years/${year}/sprints`, label: "Sprints" },
    ] : []),
    ...(sprintHref ? [{ href: sprintHref, label: sprintName || "Sprint" }] : []),
    { href: projectsHref, label: "Projects" },
  ];
  return <nav className="breadcrumb project-breadcrumb" aria-label="เส้นทาง Project">
    <Link className="breadcrumb-year" href={year ? `/groups?year=${year}` : "/groups"}>{year ? `ปี ${year}` : "เลือกปี"}</Link>
    <ChevronRight size={15} aria-hidden="true" />
    <details className="breadcrumb-ancestors">
      <summary aria-label="เปิดเส้นทางย้อนกลับ">…</summary>
      <div className="breadcrumb-ancestor-links">{ancestors.map((item, index) => <Link key={`${item.href}:${index}`} href={item.href} onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>{item.label}</Link>)}</div>
    </details>
    <ChevronRight size={15} aria-hidden="true" />
    <strong aria-current="page" title={projectName}>{projectName}</strong>
  </nav>;
}
