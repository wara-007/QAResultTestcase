import { notFound } from "next/navigation";
import { QaWorkspace } from "@/components/qa-workspace";
import { loadProjects } from "@/lib/projects-server";

export const dynamic = "force-dynamic";

export default async function TestCasePage({ params }: PageProps<"/groups/[groupId]/projects/[projectId]/test-cases/[testCaseId]">) {
  const { groupId, projectId, testCaseId } = await params;
  const { configured, projects, error, currentUser } = await loadProjects(groupId);
  if (configured && !error && !projects.some((project) => project.id === projectId)) notFound();

  return <QaWorkspace configured={configured} initialProjects={projects} projectsError={error} groupId={groupId} selectedProjectId={projectId} activePage="test-cases" currentUser={currentUser} testCaseId={testCaseId} />;
}
