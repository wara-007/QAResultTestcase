import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ params }: PageProps<"/groups/[groupId]/projects">) {
  const { groupId } = await params;
  redirect(`/groups/${groupId}/years`);
}
