import type { TestCase } from "./types";

export function refreshCaseDraft(draft: TestCase, previous: TestCase, incoming: TestCase): TestCase {
  const next = { ...incoming };
  for (const key of Object.keys(draft) as (keyof TestCase)[]) {
    // Imported data can change while the drawer is open. Only carry forward
    // fields that diverged from the last incoming snapshot (unsaved QA edits).
    if (JSON.stringify(draft[key]) !== JSON.stringify(previous[key])) {
      Object.assign(next, { [key]: draft[key] });
    }
  }
  return next;
}
