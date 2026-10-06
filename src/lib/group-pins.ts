import type { Group } from "./types";

export function sortGroupsByPinned(groups: readonly Group[]) {
  return [...groups.filter((group) => group.isPinned), ...groups.filter((group) => !group.isPinned)];
}
