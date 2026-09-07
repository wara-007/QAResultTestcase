import { QaWorkspace } from "@/components/qa-workspace";
import { loadProjects } from "@/lib/projects-server";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ params }: PageProps<"/groups/[groupId]/projects">) {
  const { groupId } = await params;
  const { configured, projects, error, currentUser } = await loadProjects(groupId);

  return <QaWorkspace configured={configured} initialProjects={projects} projectsError={error} groupId={groupId} activePage="projects" currentUser={currentUser} />;
}
