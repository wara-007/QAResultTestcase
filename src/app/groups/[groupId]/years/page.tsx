import { PlanningHome } from "@/components/planning-home";
import { loadPlanning } from "@/lib/planning-server";
import { loadProjects } from "@/lib/projects-server";
export default async function YearsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const [planning, workspace] = await Promise.all([loadPlanning(groupId), loadProjects(groupId)]);
  return <PlanningHome {...planning} groupId={groupId} projects={workspace.projects} currentUser={workspace.currentUser} error={planning.error || workspace.error} />;
}
