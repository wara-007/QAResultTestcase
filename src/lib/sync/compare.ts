import type { CanonicalProjectSnapshot } from "./types";
import { normalizeComparableText } from "./semantic";

export type SyncState = "synced" | "local_ahead" | "remote_ahead" | "both_changed" | "conflict";
export type SyncFieldConflict = { path: string; baseline: unknown; local: unknown; remote: unknown; kind: "value" | "delete_edit" };
export type SyncPreview = {
  state: SyncState;
  merged: CanonicalProjectSnapshot;
  conflicts: SyncFieldConflict[];
  localChanged: boolean;
  remoteChanged: boolean;
};

const caseInsensitiveFields = new Set(["platform", "status", "device", "environment"]);
const ignoredFields = new Set(["createdAt"]);

function semantic(value: unknown, path: string): unknown {
  const field = path.split(".").at(-1) ?? "";
  if (ignoredFields.has(field)) return undefined;
  if (value == null) return "";
  if (typeof value === "string") {
    const normalized = normalizeComparableText(value);
    return caseInsensitiveFields.has(field) ? normalized.toLocaleLowerCase() : normalized;
  }
  if (Array.isArray(value)) return value.map((item, index) => semantic(item, `${path}.${index}`));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !ignoredFields.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, semantic(item, `${path}.${key}`)]));
  }
  return value;
}

function equal(left: unknown, right: unknown, path: string) {
  return JSON.stringify(semantic(left, path)) === JSON.stringify(semantic(right, path));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareValue(path: string, baseline: unknown, local: unknown, remote: unknown, conflicts: SyncFieldConflict[]): unknown {
  if (equal(local, remote, path)) return local ?? remote;
  if (equal(local, baseline, path)) return remote;
  if (equal(remote, baseline, path)) return local;

  if ((isRecord(local) || isRecord(remote)) && (isRecord(baseline) || baseline == null)) {
    const base = isRecord(baseline) ? baseline : {};
    const left = isRecord(local) ? local : {};
    const right = isRecord(remote) ? remote : {};
    const keys = [...new Set([...Object.keys(base), ...Object.keys(left), ...Object.keys(right)])].sort();
    return Object.fromEntries(keys.flatMap((key) => {
      if (ignoredFields.has(key)) return [];
      const value = compareValue(`${path}.${key}`, base[key], left[key], right[key], conflicts);
      return value === undefined ? [] : [[key, value]];
    }));
  }

  conflicts.push({ path, baseline, local, remote, kind: local == null || remote == null ? "delete_edit" : "value" });
  return local;
}

export function compareSnapshots(baseline: CanonicalProjectSnapshot, local: CanonicalProjectSnapshot, remote: CanonicalProjectSnapshot): SyncPreview {
  const conflicts: SyncFieldConflict[] = [];
  const merged = compareValue("cases", baseline.cases, local.cases, remote.cases, conflicts) as CanonicalProjectSnapshot["cases"];
  const localChanged = !equal(local, baseline, "snapshot");
  const remoteChanged = !equal(remote, baseline, "snapshot");
  const state: SyncState = conflicts.length ? "conflict"
    : localChanged && remoteChanged ? "both_changed"
      : localChanged ? "local_ahead"
        : remoteChanged ? "remote_ahead"
          : "synced";
  return { state, merged: { cases: merged }, conflicts, localChanged, remoteChanged };
}
