# Equal group member permissions

Run the complete migration in Supabase SQL Editor:
`supabase/migrations/20261009123224_equal_group_member_access.sql`.

This changes permissions for existing and future group members, including the
legacy `viewer` role. All group members may create and edit Sprints, manage
members, and create/edit/delete any Project inside their group. Group deletion
remains on the Manage Group page. The group owner cannot be removed as a member;
their ownership identity remains intact. System Owner privileges are unchanged.

Users outside a group retain existing read-only catalog access. Pending invites
do not grant membership until claimed. Application approval is still required.
Existing Project creators retain their existing Project management rights.

Direct Data API deletion of groups/projects stays revoked. Deletion goes through
the existing server actions to clean up Results, Approvals, and system-owned
evidence. Original Google Sheets and imported media are not deleted. Google
cleanup remains best-effort with a warning if permission is unavailable.

Existing Project/Sprint history triggers are preserved. The migration is
transactional and safe to rerun. It does not alter membership rows or delete data.

The header search uses the signed-in user's RLS client, searches Project names
across all groups/years/Sprints, and shows up to 25 results per query. A narrower
query is requested when more results exist. It never grants edit access.
