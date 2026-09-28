import { notFound } from "next/navigation";
import { QaWorkspace } from "@/components/qa-workspace";
import { loadProjects } from "@/lib/projects-server";

export const dynamic = "force-dynamic";

export default async function SheetDetailPage({ params }: { params: Promise<{ groupId: string; projectId: string; sheetName: string }> }) {
  const { groupId, projectId, sheetName } = await params;
  const { configured, projects, error, currentUser } = await loadProjects(groupId);
  if (configured && !error && !projects.some((project) => project.id === projectId)) notFound();

  return <QaWorkspace configured={configured} initialProjects={projects} projectsError={error} groupId={groupId} selectedProjectId={projectId} activePage="test-cases" currentUser={currentUser} sheetName={sheetName} />;
}
