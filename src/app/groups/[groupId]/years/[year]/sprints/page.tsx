import { notFound } from "next/navigation";
import { PlanningHome } from "@/components/planning-home";
import { loadPlanning } from "@/lib/planning-server";
import { loadProjects } from "@/lib/projects-server";
export default async function SprintsPage({ params }: { params: Promise<{ groupId: string; year: string }> }) {
  const { groupId, year } = await params;
  const [planning, workspace] = await Promise.all([loadPlanning(groupId), loadProjects(groupId)]);
  if (!planning.error && !planning.years.some((y) => y.year === Number(year))) notFound();
  return <PlanningHome {...planning} groupId={groupId} year={Number(year)} projects={workspace.projects} currentUser={workspace.currentUser} error={planning.error || workspace.error} />;
}
