import type { TestCase, TestCaseCustomField } from "../types";
import { normalizedCaseId } from "./client-conflicts";
import { reconcileStepCases, replaceLegacyStepPreviews } from "../step-reconciliation";

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
      ...(google.stepDefinitions || local.stepDefinitions ? (() => { const reconciled = reconcileStepCases(local, google).testCase; return { stepDefinitions: reconciled.stepDefinitions, importIssues: reconciled.importIssues }; })() : {}),
      recordId: local.recordId,
      executionId: local.executionId,
      persistedLocally: local.persistedLocally,
      results: (() => {
        const localResults = google.stepDefinitions?.length ? replaceLegacyStepPreviews(local.results ?? [], google.results ?? []) : local.results ?? [];
        const refreshed = new Map((google.results ?? []).map(result => [`${result.sourceSheetName ?? ""}:${result.id}`, result]));
        const merged = localResults.map(result => {
          const key = `${result.sourceSheetName ?? ""}:${result.id}`;
          const fresh = refreshed.get(key);
          refreshed.delete(key);
          // Only auto-imported snapshots refresh; never overwrite a QA-authored Result.
          return fresh && result.id.startsWith("SHEET-IMPORT-") && !result.editedLocally
            ? { ...result, ...fresh, ...(result.stepMappingHistory?.length ? { stepId: result.stepId, stepMappingHistory: result.stepMappingHistory } : {}), sheetDisplay: result.sheetDisplay ?? fresh.sheetDisplay, evidence: result.evidence.length ? result.evidence : fresh.evidence, createdAt: result.createdAt }
            : result;
        });
        return [...merged, ...refreshed.values()];
      })(),
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
