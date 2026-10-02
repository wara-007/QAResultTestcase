import { notFound } from "next/navigation";
import { PlanningHome } from "@/components/planning-home";
import { loadPlanning } from "@/lib/planning-server";
import { loadProjects } from "@/lib/projects-server";
import { parseWorkspaceYear } from '@/lib/year-navigation';
export default async function SprintsPage({ params }: { params: Promise<{ groupId: string; year: string }> }) {
  const { groupId, year } = await params;
  const selectedYear=parseWorkspaceYear(year);
  if(selectedYear===undefined) notFound();
  const [planning, workspace] = await Promise.all([loadPlanning(groupId), loadProjects(groupId)]);
  return <PlanningHome key={`${groupId}:${selectedYear}`} {...planning} groupId={groupId} year={selectedYear} projects={workspace.projects} currentUser={workspace.currentUser} error={planning.error || workspace.error} />;
}
