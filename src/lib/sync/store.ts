import type { SupabaseClient } from "@supabase/supabase-js";
import { hashSnapshot } from "./canonical";
import type { CanonicalProjectSnapshot, CanonicalTestCase } from "./types";

export type BaselineRow = {
  project_id: string;
  testcase_key: string;
  snapshot: CanonicalTestCase;
  snapshot_hash: string;
  synced_by: string | null;
  synced_at?: string;
};

export function isMissingBaselineTableError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || Boolean(error?.message?.includes("test_case_sync_baselines") && error.message.includes("schema cache"));
}

const fallbackKey = "syncBaselineV1";

export function baselineSnapshotFromMapping(mapping: Record<string, unknown> | null | undefined): CanonicalProjectSnapshot {
  const value = mapping?.[fallbackKey];
  if (!value || typeof value !== "object" || !("cases" in value)) return { cases: {} };
  const cases = (value as { cases?: unknown }).cases;
  return cases && typeof cases === "object" ? { cases: cases as CanonicalProjectSnapshot["cases"] } : { cases: {} };
}

export function mappingWithBaselineSnapshot(mapping: Record<string, unknown> | null | undefined, snapshot: CanonicalProjectSnapshot): Record<string, unknown> {
  return { ...(mapping ?? {}), [fallbackKey]: snapshot };
}

async function loadFallbackBaseline(client: SupabaseClient, projectId: string) {
  const result = await client.from("source_files").select("column_mapping").eq("project_id", projectId)
    .order("version_no", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return baselineSnapshotFromMapping(result.data?.column_mapping as Record<string, unknown> | null | undefined);
}

async function replaceFallbackBaseline(client: SupabaseClient, projectId: string, snapshot: CanonicalProjectSnapshot) {
  const current = await client.from("source_files").select("id,column_mapping").eq("project_id", projectId)
    .order("version_no", { ascending: false }).limit(1).maybeSingle();
  if (current.error) throw new Error(current.error.message);
  if (!current.data) return false;
  const saved = await client.from("source_files").update({
    column_mapping: mappingWithBaselineSnapshot(current.data.column_mapping as Record<string, unknown> | null | undefined, snapshot),
  }).eq("id", current.data.id);
  if (saved.error) throw new Error(saved.error.message);
  return true;
}

export function snapshotToBaselineRows(projectId: string, snapshot: CanonicalProjectSnapshot, actorId: string | null): BaselineRow[] {
  return Object.entries(snapshot.cases).map(([testcaseKey, value]) => ({
    project_id: projectId,
    testcase_key: testcaseKey,
    snapshot: value,
    snapshot_hash: hashSnapshot({ cases: { [testcaseKey]: value } }),
    synced_by: actorId,
  }));
}

export function baselineRowsToSnapshot(rows: Array<Pick<BaselineRow, "testcase_key" | "snapshot">>): CanonicalProjectSnapshot {
  return { cases: Object.fromEntries(rows.map((row) => [row.testcase_key, row.snapshot])) };
}

export async function loadBaselines(client: SupabaseClient, projectId: string): Promise<CanonicalProjectSnapshot> {
  const result = await client.from("test_case_sync_baselines").select("testcase_key,snapshot").eq("project_id", projectId);
  if (isMissingBaselineTableError(result.error)) return loadFallbackBaseline(client, projectId);
  if (result.error) throw new Error(result.error.message);
  return baselineRowsToSnapshot((result.data ?? []) as Array<Pick<BaselineRow, "testcase_key" | "snapshot">>);
}

export async function replaceBaselines(client: SupabaseClient, projectId: string, snapshot: CanonicalProjectSnapshot, actorId: string | null) {
  const rows = snapshotToBaselineRows(projectId, snapshot, actorId);
  const existing = await client.from("test_case_sync_baselines").select("testcase_key").eq("project_id", projectId);
  if (isMissingBaselineTableError(existing.error)) return replaceFallbackBaseline(client, projectId, snapshot);
  if (existing.error) throw new Error(existing.error.message);
  const nextIds = new Set(rows.map((row) => row.testcase_key));
  const removedIds = (existing.data ?? []).map((row) => String(row.testcase_key)).filter((id) => !nextIds.has(id));
  if (removedIds.length) {
    const removed = await client.from("test_case_sync_baselines").delete().eq("project_id", projectId).in("testcase_key", removedIds);
    if (removed.error) throw new Error(removed.error.message);
  }
  if (rows.length) {
    const saved = await client.from("test_case_sync_baselines").upsert(rows, { onConflict: "project_id,testcase_key" });
    if (saved.error) throw new Error(saved.error.message);
  }
  return true;
}
