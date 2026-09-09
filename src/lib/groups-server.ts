import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CurrentUser, Group, GroupMember } from "@/lib/types";

type GroupMemberRow = { member_id: string | null; email: string; display_name: string; role: GroupMember["role"]; pending: boolean; is_owner: boolean };

export async function loadGroupMembers(groupId: string): Promise<{ members: GroupMember[]; groupName: string; error: string }> {
  const supabase = await createClient();
  await supabase.rpc("claim_group_invitations");
  const [membersResult, groupResult] = await Promise.all([
    supabase.rpc("list_group_members", { requested_group_id: groupId }),
    supabase.from("groups").select("name").eq("id", groupId).single(),
  ]);
  const error = membersResult.error?.message ?? groupResult.error?.message ?? "";
  return {
    groupName: groupResult.data?.name ?? "Group",
    error,
    members: ((membersResult.data ?? []) as GroupMemberRow[]).map((member) => ({ memberId: member.member_id ?? "", email: member.email, displayName: member.display_name, role: member.role, pending: member.pending, isOwner: member.is_owner })),
  };
}

export async function loadGroups(): Promise<{ groups: Group[]; error: string; currentUser: CurrentUser | null }> {
  const supabase = await createClient();
  await supabase.rpc("claim_group_invitations");
  const [{ data: groups, error }, { data: projects }, { data: authData }] = await Promise.all([
    supabase.from("groups").select("id, name, description, created_at").order("created_at", { ascending: true }),
    supabase.from("projects").select("group_id"),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  const currentUser = user ? {
    id: user.id,
    email: user.email ?? "",
    name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "QA"),
  } : null;

  if (error) return { groups: [], error: error.message, currentUser };
  const counts = new Map<string, number>();
  for (const project of projects ?? []) counts.set(project.group_id, (counts.get(project.group_id) ?? 0) + 1);

  return {
    error: "",
    currentUser,
    groups: (groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      projectCount: counts.get(group.id) ?? 0,
      createdAt: group.created_at,
    })),
  };
}
