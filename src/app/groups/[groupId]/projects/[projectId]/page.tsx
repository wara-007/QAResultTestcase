import { redirect } from "next/navigation";

export default async function ProjectPage({ params }: PageProps<"/groups/[groupId]/projects/[projectId]">) {
  const { groupId, projectId } = await params;
  redirect(`/groups/${groupId}/projects/${projectId}/overview`);
}
