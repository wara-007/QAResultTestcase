import { redirect } from "next/navigation";

export default async function TestCasePreviewRedirect({ params }: {
  params: Promise<{ groupId: string; projectId: string; testCaseId: string }>;
}) {
  const { groupId, projectId, testCaseId } = await params;
  redirect(`/groups/${encodeURIComponent(groupId)}/projects/${encodeURIComponent(projectId)}/test-cases/${encodeURIComponent(testCaseId)}`);
}
