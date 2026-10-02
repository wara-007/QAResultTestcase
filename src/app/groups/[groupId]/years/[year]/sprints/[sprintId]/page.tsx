import { notFound } from "next/navigation";
import { PlanningHome } from "@/components/planning-home";
import { loadPlanning, loadSprintDashboard } from "@/lib/planning-server";
import { loadProjects } from "@/lib/projects-server";
import { SprintDashboard } from '@/components/sprint-dashboard';
export default async function SprintPage({ params }: { params: Promise<{ groupId: string; year: string; sprintId: string }> }) {
  const { groupId, year, sprintId } = await params;
  const [planning, workspace] = await Promise.all([loadPlanning(groupId), loadProjects(groupId)]);
  if (!planning.error && !planning.sprints.some((s) => s.id === sprintId && s.year === Number(year))) notFound();
  const dashboard = planning.error || workspace.error ? undefined : await loadSprintDashboard(groupId,sprintId,workspace.projects);
  const sprint=planning.sprints.find(s=>s.id===sprintId);
  if(sprint && dashboard?.data && !dashboard.error) return <SprintDashboard groupId={groupId} groupName={planning.groupName} sprint={{...sprint,canManage:dashboard.canManage}} data={dashboard.data} currentUser={workspace.currentUser} sprintHistory={dashboard.sprintHistory}/>;
  return <PlanningHome {...planning} groupId={groupId} year={Number(year)} sprintId={sprintId} projects={workspace.projects} currentUser={workspace.currentUser} error={planning.error || workspace.error || dashboard?.error || ""} />;
}
