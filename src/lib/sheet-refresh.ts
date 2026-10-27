import { alignRegisterCaseIdentities } from "./register-case-identity";
import type { TestCase } from './types';
import { normalizedCaseId } from './sync/client-conflicts';
import { mergeWorkspaceAndGoogleCases } from './sync/workspace-merge';

const fields = ['name','scenario','condition','steps','expected','platform','testData','status','device','appVersion','environment','executedBy','executedDate','executedTime','remark','resultReference'] as const;
export type RegisterBaseline = Record<string, Record<string, string>>;
// Validate every row without imposing a final-checkpoint-only case limit.
export function isRegisterBaseline(value: unknown): value is RegisterBaseline {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every(row => row && typeof row === 'object' && !Array.isArray(row)
      && Object.entries(row).every(([key, text]) => fields.includes(key as typeof fields[number]) && typeof text === 'string'));
}
export function sheetRefreshRequired(saved: {sourceRevision?: string;refreshRequired?: boolean}|undefined, revision: string) {
  return !saved?.sourceRevision || saved.sourceRevision !== revision || saved.refreshRequired === true;
}
/** An unchanged workbook can still have an interrupted import to finish. */
export function automaticSheetImportMode(saved: {sourceRevision?: string; refreshRequired?: boolean; complete: boolean} | undefined, revision: string): 'fresh' | 'resume' | null {
  if (sheetRefreshRequired(saved, revision)) return 'fresh';
  return saved?.complete ? null : 'resume';
}
export function registerBaseline(cases: TestCase[]): RegisterBaseline {
  return Object.fromEntries(cases.map(item => [normalizedCaseId(item.id), Object.fromEntries(fields.map(field => [field,item[field] ?? '']))]));
}
/** Sheets is authoritative for imported case fields and step definitions.
 * Merge durable QA results/evidence before replacing the source-owned fields. */
export function refreshRegisterCases(local: TestCase[], remote: TestCase[], options: { definitionsReady?: boolean } = {}) {
  remote = alignRegisterCaseIdentities(local, remote);
  const remoteById = new Map(remote.map(item => [normalizedCaseId(item.id), item]));
  const cases = mergeWorkspaceAndGoogleCases(local, remote, '').cases.map(merged => {
    const incoming = remoteById.get(normalizedCaseId(merged.id));
    if (!incoming) return merged;
    const knownFields = options.definitionsReady === false ? fields.filter(field => field !== 'steps' && field !== 'expected') : fields;
    const updates = Object.fromEntries(knownFields.map(field => [field, incoming[field] ?? '']));
    return { ...merged, ...updates, resultReferenceTargets: incoming.resultReferenceTargets, resultReferenceLinks: incoming.resultReferenceLinks, registerIdentity: incoming.registerIdentity, sourceRow: incoming.sourceRow,
      ...(options.definitionsReady === false ? {} : { stepDefinitions: incoming.stepDefinitions, importIssues: incoming.importIssues ?? [] }),
    } as TestCase;
  });
  return { cases, conflicts: [] };
}

/** A saved partial merge contains local QA definitions; it is not source data. */
export function withSavedCaseIdentity(source: TestCase, saved: Pick<TestCase, 'recordId' | 'executionId'>): TestCase {
  return { ...source, recordId: saved.recordId, executionId: saved.executionId };
}

export function sheetImportRevisionStatus(captured: string, current: string, dataComplete: boolean) {
  const unchanged = !!captured && captured === current;
  return { complete: unchanged && dataComplete, refreshRequired: !unchanged };
}

/** The register may omit steps that are defined only in individual result tabs. */
export function withWorkbookDefinitions(remote: TestCase[], workbook: TestCase[]): TestCase[] {
  const byId = new Map(workbook.map(item => [normalizedCaseId(item.id), item]));
  return remote.map(item => {
    const definition = byId.get(normalizedCaseId(item.id));
    return definition?.stepDefinitions?.length && !item.stepDefinitions?.length
      ? { ...item, steps: definition.steps, expected: definition.expected, stepDefinitions: definition.stepDefinitions }
      : item;
  });
}
