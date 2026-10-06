import assert from "node:assert/strict";
import test from "node:test";
import type { Group } from "./types";
import { sortGroupsByPinned } from "./group-pins";

function group(id: string, isPinned = false): Group {
  return { id, name: id, description: "", projectCount: 0, createdAt: "2026-01-01", canAccess: true, canManage: false, isPinned };
}

test("pinned groups appear first while preserving each section's original order", () => {
  const groups = [group("A"), group("B", true), group("C"), group("D", true)];
  assert.deepEqual(sortGroupsByPinned(groups).map((item) => item.id), ["B", "D", "A", "C"]);
});

test("sorting does not mutate the loaded group array", () => {
  const groups = [group("A"), group("B", true)];
  sortGroupsByPinned(groups);
  assert.deepEqual(groups.map((item) => item.id), ["A", "B"]);
});
