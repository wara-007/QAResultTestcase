import { GroupMembers } from "@/components/group-members";
import { loadGroupMembers } from "@/lib/groups-server";

export const dynamic = "force-dynamic";

export default async function GroupMembersPage({ params }: PageProps<"/groups/[groupId]/members">) {
  const { groupId } = await params;
  const { members, groupName, canDelete, error } = await loadGroupMembers(groupId);
  return <GroupMembers groupId={groupId} groupName={groupName} canDelete={canDelete} initialMembers={members} initialError={error} />;
}
