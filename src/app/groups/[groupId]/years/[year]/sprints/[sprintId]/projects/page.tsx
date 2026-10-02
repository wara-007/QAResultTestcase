import { notFound } from "next/navigation";
import { QaWorkspace } from "@/components/qa-workspace";
import { loadPlanning } from "@/lib/planning-server";
import { loadProjects } from "@/lib/projects-server";
export default async function SprintProjectsPage({ params }: { params: Promise<{ groupId: string; year: string; sprintId: string }> }) {
  const { groupId, year, sprintId } = await params;
  const [planning, workspace] = await Promise.all([loadPlanning(groupId), loadProjects(groupId)]);
  const sprint = planning.sprints.find((s) => s.id === sprintId && s.year === Number(year));
  if (!planning.error && !sprint) notFound();
  return <QaWorkspace configured={workspace.configured} initialProjects={workspace.projects.filter((p) => p.sprintId === sprintId)} projectsError={planning.error || workspace.error} currentUser={workspace.currentUser} groupId={groupId} activePage="projects" planningSprint={sprint} canCreateProject={planning.canPlan} />;
}
