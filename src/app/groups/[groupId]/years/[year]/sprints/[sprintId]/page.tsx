import { notFound } from "next/navigation";
import { PlanningHome } from "@/components/planning-home";
import { loadPlanning } from "@/lib/planning-server";
import { loadProjects } from "@/lib/projects-server";
import { SprintDashboardLoader } from '@/components/sprint-dashboard-loader';
export default async function SprintPage({ params }: { params: Promise<{ groupId: string; year: string; sprintId: string }> }) {
  const { groupId, year, sprintId } = await params;
  const [planning, workspace] = await Promise.all([loadPlanning(groupId), loadProjects(groupId)]);
  if (!planning.error && !planning.sprints.some((s) => s.id === sprintId && s.year === Number(year))) notFound();
  const sprint=planning.sprints.find(s=>s.id===sprintId);
  if(sprint && !planning.error && !workspace.error) return <SprintDashboardLoader key={`${groupId}:${sprint.id}:${workspace.currentUser?.id ?? "guest"}`} groupId={groupId} groupName={planning.groupName} sprint={sprint} projects={workspace.projects} currentUser={workspace.currentUser}/>;
  return <PlanningHome {...planning} groupId={groupId} year={Number(year)} sprintId={sprintId} projects={workspace.projects} currentUser={workspace.currentUser} error={planning.error || workspace.error || ""} />;
}
