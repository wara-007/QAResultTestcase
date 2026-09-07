import { notFound } from "next/navigation";
import { QaWorkspace, type ProjectPageName } from "@/components/qa-workspace";
import { loadProjects } from "@/lib/projects-server";

export const dynamic = "force-dynamic";

const PROJECT_PAGES: ProjectPageName[] = ["overview", "test-cases", "defects", "files", "settings"];

export default async function ProjectSectionPage({ params }: PageProps<"/groups/[groupId]/projects/[projectId]/[section]">) {
  const { groupId, projectId, section } = await params;
  if (!PROJECT_PAGES.includes(section as ProjectPageName)) notFound();

  const { configured, projects, error, currentUser } = await loadProjects(groupId);
  if (configured && !error && !projects.some((project) => project.id === projectId)) notFound();

  return (
    <QaWorkspace
      configured={configured}
      initialProjects={projects}
      projectsError={error}
      groupId={groupId}
      selectedProjectId={projectId}
      activePage={section as ProjectPageName}
      currentUser={currentUser}
    />
  );
}
