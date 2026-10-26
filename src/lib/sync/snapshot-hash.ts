import { createHash } from "node:crypto";
import type { CanonicalProjectSnapshot } from "./types";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}

export function hashSnapshot(snapshot: CanonicalProjectSnapshot) {
  return createHash("sha256").update(JSON.stringify(stable(snapshot))).digest("hex");
}
