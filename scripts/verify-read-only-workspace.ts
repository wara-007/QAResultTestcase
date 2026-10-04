import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workspace = read("src/components/qa-workspace.tsx");
const actions = read("src/app/actions.ts");
const evidenceRoute = read("src/app/api/projects/[projectId]/evidence/route.ts");
const googleRoute = read("src/app/api/projects/[projectId]/google-sheet/route.ts");
const mappingServer = read("src/lib/sheet-mappings.ts");
const accessServer = read("src/lib/project-access-server.ts");
const migration = read("supabase/migrations/20260929114538_global_project_read_and_sheet_mappings.sql");

assert.match(accessServer, /requireProjectCapability/, "server must centralize Project capability checks");
assert.match(accessServer, /ProjectAccessError\([^\n]+,\s*401\)/, "unauthenticated Project requests must be distinguishable as 401");
assert.match(accessServer, /ProjectAccessError\([^\n]+,\s*403\)/, "authenticated viewers must be rejected as 403");
assert.match(actions, /getSignedInProject\(input\.projectId,\s*"edit"\)/, "approval submission must require edit permission");
assert.match(actions, /requireProjectCapability\(projectId,\s*"manage"\)/, "changing the connected Sheet must require manage permission");
assert.match(actions, /requireProjectCapability\(projectId,\s*"delete"\)/, "Project deletion must require delete permission");
assert.match(evidenceRoute, /requireProjectCapability\(projectId,\s*"edit"\)/, "evidence uploads must require edit permission");
assert.match(googleRoute, /requireProjectCapability\(projectId,\s*"edit"\)/, "Google Sheet writes must require edit permission");
assert.match(mappingServer, /requireProjectCapability\(projectId,\s*requireEdit\s*\?\s*"edit"\s*:\s*"view"\)/, "mapping writes must use the shared server permission guard");

assert.match(workspace, /const canEditProject = selectedProject\?\.canEdit === true/, "workspace must derive a strict edit capability");
assert.match(workspace, /read-only-badge/, "read-only viewers must see a mode badge");
assert.match(workspace, /read-only-notice/, "read-only viewers must see an explanation");
for (const capabilityGuard of [
  /selectedProject\.googleSheetId\s*\?\s*canEditProject\s*:\s*canManageProject/,
  /canEditProject\s*&&\s*selectedProject\.googleSheetId\s*&&\s*<button[\s\S]{0,500}ซิงค์กลับ Google Sheets/,
  /canEditProject\s*&&\s*<button[\s\S]{0,300}เพิ่ม Test Case/,
  /<ProjectApprovalPanel[^>]+canSubmit=\{canEditProject\}/,
  // Importing may add a temporary read-only condition, never remove the viewer guard.
  /<CaseDrawer[\s\S]+?readOnly=\{!canEditProject(?: \|\| pullingGoogle)?\}/,
]) assert.match(workspace, capabilityGuard, `missing read-only UI guard: ${capabilityGuard}`);

assert.match(migration, /private\.has_app_access\(\).*private\.can_view_project/s, "allowlisted non-members must receive global Project view access");
assert.match(migration, /project_sheet_mappings_insert_editor[\s\S]*private\.can_edit_project/, "PO/viewer mapping writes must remain denied by RLS");
assert.match(migration, /private\.is_system_owner\(\).*owner_id/s, "Project delete capability must remain owner/System Owner only");

console.log("Read-only workspace regression checks passed");
