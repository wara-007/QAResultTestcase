import { GroupMembers } from "@/components/group-members";
import { loadGroupMembers } from "@/lib/groups-server";

export const dynamic = "force-dynamic";

export default async function GroupMembersPage({ params }: PageProps<"/groups/[groupId]/members">) {
  const { groupId } = await params;
  const { members, groupName, error } = await loadGroupMembers(groupId);
  return <GroupMembers groupId={groupId} groupName={groupName} initialMembers={members} initialError={error} />;
}
