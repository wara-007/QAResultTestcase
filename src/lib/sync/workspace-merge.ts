import type { TestCase, TestCaseCustomField } from "../types";
import { normalizedCaseId } from "./client-conflicts";

function fieldIdentity(field: TestCaseCustomField) {
  return `${field.source}:${field.sheetName.trim().toLowerCase()}:${field.label.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`;
}

function mergeFields(googleFields: TestCaseCustomField[] = [], localFields: TestCaseCustomField[] = []) {
  const googleKeys = new Set(googleFields.map(fieldIdentity));
  return [...googleFields, ...localFields.filter((field) => !googleKeys.has(fieldIdentity(field)))];
}

export function mergeWorkspaceAndGoogleCases(localCases: TestCase[], googleCases: TestCase[], currentUserName: string) {
  const localById = new Map(localCases.map((item) => [normalizedCaseId(item.id), item]));
  const mergedGoogleCases = googleCases.map((google) => {
    const local = localById.get(normalizedCaseId(google.id));
    if (!local) return google;
    const hasLocalExecution = Boolean(local.persistedLocally || local.results?.length || local.defects?.length);
    const shared = {
      recordId: local.recordId,
      executionId: local.executionId,
      persistedLocally: local.persistedLocally,
      results: local.results?.length ? local.results : google.results,
      defects: local.defects?.length ? local.defects : google.defects,
      customFields: mergeFields(google.customFields, local.customFields),
      resultFieldDefinitions: google.resultFieldDefinitions?.length ? google.resultFieldDefinitions : local.resultFieldDefinitions,
      evidence: local.evidence,
    };
    if (!hasLocalExecution) return { ...google, ...shared };
    return {
      ...google,
      ...local,
      ...shared,
      executedBy: local.executedBy || currentUserName || google.executedBy,
    };
  });
  const googleIds = new Set(googleCases.map((item) => normalizedCaseId(item.id)));
  const localOnlyCases = localCases.filter((item) => !googleIds.has(normalizedCaseId(item.id)));
  return { cases: [...mergedGoogleCases, ...localOnlyCases], localOnlyCases };
}
