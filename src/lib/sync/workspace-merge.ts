import { isMissingResultReferenceIssue } from "../register-result-references";
import type { TestCase, TestCaseCustomField } from "../types";
import { normalizedCaseId } from "./client-conflicts";
import { reconcileStepCases, replaceLegacyStepPreviews } from "../step-reconciliation";
import { isUnnamedSheetSkip } from "../sheet-skip-tester";

/** Reading a result tab must not silently import new register entries. */
export function scopeGoogleDetailCases(savedCases: TestCase[], incoming: TestCase[]) {
  if (!savedCases.length) return incoming;
  const savedIds = new Set(savedCases.map(item => normalizedCaseId(item.id)));
  return incoming.filter(item => savedIds.has(normalizedCaseId(item.id)) || item.sourceSheetName);
}

function fieldIdentity(field: TestCaseCustomField) {
  return `${field.source}:${field.sheetName.trim().toLowerCase()}:${field.label.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`;
}

function mergeFields(googleFields: TestCaseCustomField[] = [], localFields: TestCaseCustomField[] = []) {
  const googleKeys = new Set(googleFields.map(fieldIdentity));
  return [...googleFields, ...localFields.filter((field) => !googleKeys.has(fieldIdentity(field)))];
}

export function mergeWorkspaceAndGoogleCases(localCases: TestCase[], googleCases: TestCase[], currentUserName: string) {
  // Kept for existing callers; an importer is not an executed-by fallback.
  void currentUserName;
  const localById = new Map(localCases.map((item) => [normalizedCaseId(item.id), item]));
  const mergedGoogleCases = googleCases.map((google) => {
    const local = localById.get(normalizedCaseId(google.id));
    if (!local) return google;
    const hasLocalExecution = Boolean(local.persistedLocally || local.results?.length || local.defects?.length);
    const shared = {
      sourceSheetName: google.sourceSheetName,
      resultReferenceTargets: google.resultReferenceTargets,
      registerIdentity: google.registerIdentity ?? local.registerIdentity,
      importIssues: [...new Set([...(local.importIssues ?? []).filter(issue => !isMissingResultReferenceIssue(issue)), ...(google.importIssues ?? [])])],
      sourceFields: google.sourceFields ?? local.sourceFields,
      ...(google.stepDefinitions || local.stepDefinitions ? (() => { const reconciled = reconcileStepCases(local, google).testCase; return { stepDefinitions: reconciled.stepDefinitions, importIssues: reconciled.importIssues }; })() : {}),
      recordId: local.recordId,
      executionId: local.executionId,
      persistedLocally: local.persistedLocally,
      results: (() => {
        const localResults = replaceLegacyStepPreviews(local.results ?? [], google.results ?? []);
        const refreshed = new Map((google.results ?? []).map(result => [`${result.sourceSheetName ?? ""}:${result.id}`, result]));
        // Version 2 proves explicit inline row ownership. Retire only obsolete
        // automatic snapshots with no saved proof or QA changes.
        const scopedSheets = new Set((google.results ?? []).filter(result => result.stepSheetMappingVersion === 2).map(result => result.sourceSheetName));
        const merged = localResults.filter(result => {
          const key = `${result.sourceSheetName ?? ""}:${result.id}`;
          return !scopedSheets.has(result.sourceSheetName) || refreshed.has(key)
            || result.source !== "sheets" || !/-STEP-\d+$/.test(result.id) || !result.id.startsWith("SHEET-IMPORT-")
            || result.editedLocally || result.evidence.length > 0 || Boolean(result.stepMappingHistory?.length);
        }).map(result => {
          const key = `${result.sourceSheetName ?? ""}:${result.id}`;
          const fresh = refreshed.get(key);
          refreshed.delete(key);
          // Only auto-imported snapshots refresh; never overwrite a QA-authored Result.
          return fresh && result.id.startsWith("SHEET-IMPORT-") && !result.editedLocally
            ? { ...result, ...fresh, ...(result.stepMappingHistory?.length ? { stepId: result.stepId, stepMappingHistory: result.stepMappingHistory } : {}), sheetDisplay: result.sheetDisplay ?? fresh.sheetDisplay, evidence: [...result.evidence, ...fresh.evidence.filter(item => !result.evidence.some(previous => previous.fileId === item.fileId))], createdAt: result.createdAt }
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
      executedBy: google.status === "Skip" && isUnnamedSheetSkip(google.stepDefinitions, local.results) ? "" : local.executedBy || google.executedBy,
    };
  });
  const googleIds = new Set(googleCases.map((item) => normalizedCaseId(item.id)));
  const localOnlyCases = localCases.filter((item) => !googleIds.has(normalizedCaseId(item.id)));
  return { cases: [...mergedGoogleCases, ...localOnlyCases], localOnlyCases };
}
