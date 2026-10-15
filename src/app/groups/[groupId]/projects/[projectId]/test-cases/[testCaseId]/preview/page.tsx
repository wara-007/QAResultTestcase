import { notFound } from "next/navigation";
import { QaWorkspace } from "@/components/qa-workspace";
import { loadProjects } from "@/lib/projects-server";

export const dynamic = "force-dynamic";

export default async function TestCasePreviewPage({ params, searchParams }: {
  params: Promise<{ groupId: string; projectId: string; testCaseId: string }>;
  searchParams: Promise<{ sheet?: string | string[] }>;
}) {
  const { groupId, projectId, testCaseId } = await params;
  const query = await searchParams;
  const { configured, projects, error, currentUser } = await loadProjects(groupId);
  if (configured && !error && !projects.some(project => project.id === projectId)) notFound();
  return <QaWorkspace configured={configured} initialProjects={projects} projectsError={error} groupId={groupId} selectedProjectId={projectId} activePage="test-cases" currentUser={currentUser} testCaseId={testCaseId} previewMode previewSheetName={typeof query.sheet === "string" ? query.sheet : undefined} />;
}
