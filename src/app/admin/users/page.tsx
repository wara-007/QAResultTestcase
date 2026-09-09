import { redirect } from "next/navigation";
import { SystemUsers } from "@/components/system-users";
import { loadSystemUsers } from "@/lib/system-users-server";

export const dynamic = "force-dynamic";

export default async function SystemUsersPage() {
  const { users, error, authorized } = await loadSystemUsers();
  if (!authorized) redirect("/groups");
  return <SystemUsers initialUsers={users} initialError={error} />;
}
