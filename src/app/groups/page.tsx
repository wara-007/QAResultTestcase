import { GroupsHome } from "@/components/groups-home";
import { loadGroups } from "@/lib/groups-server";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const { groups, error, currentUser } = await loadGroups();
  return <GroupsHome initialGroups={groups} error={error} currentUser={currentUser} />;
}
