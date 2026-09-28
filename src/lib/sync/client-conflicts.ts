import type { TestCase } from "../types";
import { canonicalizeCases } from "./canonical";
import { compareSnapshots } from "./compare";
import { normalizeComparableText } from "./semantic";
import type { CanonicalProjectSnapshot } from "./types";

export type CaseConflict = { id: string; local: TestCase; google: TestCase; changedFields: string[] };
export type CaseChoice = { side: "system" } | { side: "google" } | { side: "both"; newId: string };

export function normalizedCaseId(value: string) {
  const match = value.trim().match(/^(?:TC|TEST\s*CASE|TESTCASE|CASE)[\s:_-]*(\d+)$/i);
  return match ? `TC-${Number(match[1])}` : value.trim().toUpperCase();
}

const comparedFields = ["name", "scenario", "condition", "steps", "expected", "platform", "testData", "status", "device", "appVersion", "environment", "executedBy", "executedDate", "executedTime", "remark"] as const;
const bootstrapFields = ["name", "scenario", "condition", "steps", "expected", "testData"] as const;
const comparableText = normalizeComparableText;

export function detectBootstrapCaseConflicts(localCases: TestCase[], googleCases: TestCase[]) {
  const remote = new Map(googleCases.map((item) => [normalizedCaseId(item.id), item]));
  return localCases.flatMap((local): CaseConflict[] => {
    const id = normalizedCaseId(local.id);
    const google = remote.get(id);
    if (!google) return [];
    const changedFields = bootstrapFields.filter((field) => comparableText(local[field]) !== comparableText(google[field]));
    return changedFields.length ? [{ id, local, google, changedFields: [...changedFields] }] : [];
  });
}

export function detectCaseConflicts(localCases: TestCase[], googleCases: TestCase[], locallyCreatedIds: ReadonlySet<string> = new Set()) {
  const remote = new Map(googleCases.map((item) => [normalizedCaseId(item.id), item]));
  const locallyCreated = new Set([...locallyCreatedIds].map(normalizedCaseId));
  return localCases.flatMap((local): CaseConflict[] => {
    const id = normalizedCaseId(local.id);
    const google = remote.get(id);
    if (!google) return [];
    const changedFields: string[] = comparedFields.filter((field) => local[field] !== google[field]);
    for (const field of ["customFields", "results", "defects"] as const) {
      if (JSON.stringify(local[field] ?? []) !== JSON.stringify(google[field] ?? [])) changedFields.push(field);
    }
    if (!changedFields.length && locallyCreated.has(id)) changedFields.push("เพิ่มใหม่ทั้งสองฝั่ง");
    return changedFields.length ? [{ id, local, google, changedFields: [...changedFields] }] : [];
  });
}

export function detectThreeWayCaseConflicts(localCases: TestCase[], googleCases: TestCase[], baseline: CanonicalProjectSnapshot) {
  const preview = compareSnapshots(baseline, canonicalizeCases(localCases), canonicalizeCases(googleCases));
  const localById = new Map(localCases.map((item) => [normalizedCaseId(item.id), item]));
  const googleById = new Map(googleCases.map((item) => [normalizedCaseId(item.id), item]));
  const fieldsById = new Map<string, Set<string>>();
  for (const conflict of preview.conflicts) {
    const match = conflict.path.match(/^cases\.([^.]+)\.(.+)$/);
    if (!match) continue;
    const fields = fieldsById.get(match[1]) ?? new Set<string>();
    fields.add(match[2]);
    fieldsById.set(match[1], fields);
  }
  return [...fieldsById].flatMap(([id, fields]): CaseConflict[] => {
    const local = localById.get(id);
    const google = googleById.get(id);
    return local && google ? [{ id, local, google, changedFields: [...fields] }] : [];
  });
}

export function mergeCaseChoices(localCases: TestCase[], googleCases: TestCase[], choices: Record<string, CaseChoice>) {
  const merged = localCases.map((item) => ({ ...item }));
  const indexById = new Map(merged.map((item, index) => [normalizedCaseId(item.id), index]));
  const reserved = new Set([...localCases, ...googleCases].map((item) => normalizedCaseId(item.id)));
  for (const google of googleCases) {
    const id = normalizedCaseId(google.id);
    const index = indexById.get(id);
    if (index == null) {
      merged.push(google);
      indexById.set(id, merged.length - 1);
      continue;
    }
    const choice = choices[id];
    if (!choice || choice.side === "system") continue;
    if (choice.side === "google") {
      merged[index] = google;
      continue;
    }
    const newId = choice.newId.trim();
    const normalizedNewId = normalizedCaseId(newId);
    if (!newId || reserved.has(normalizedNewId)) throw new Error("Test Case ID ใหม่ต้องไม่ซ้ำกับข้อมูลเดิม");
    reserved.add(normalizedNewId);
    merged.push({ ...google, id: newId, recordId: undefined, executionId: undefined, sourceRow: Math.max(1, ...merged.map((item) => item.sourceRow)) + 1 });
  }
  return merged;
}
