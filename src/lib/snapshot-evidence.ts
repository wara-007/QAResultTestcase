import type { SnapshotCase } from './project-sprint-participation';
import type { TestEvidence } from './types';
import { snapshotCaseFromStored, type StoredCaseInput } from './project-sprint-snapshot';

export function collectSnapshotEvidence(cases:SnapshotCase[]):TestEvidence[] {
 const files=new Map<string,TestEvidence>();
 for(const {testCase:tc} of cases) for(const e of [...tc.evidence,...(tc.results ?? []).flatMap(r=>r.evidence ?? []),...(tc.defects ?? []).flatMap(d=>d.evidence ?? [])]) {
   files.set(`${e.provider ?? 'google-drive'}:${e.objectKey ?? e.fileId}`,e);
 }
 return [...files.values()];
}
export function snapshotEvidenceFromStored(rows:StoredCaseInput[]):TestEvidence[] {
 return collectSnapshotEvidence(rows.map((row,position)=>({snapshotId:'',position,testCase:snapshotCaseFromStored(row)})));
}
export function snapshotEvidenceMatches(rows:StoredCaseInput[],evidence:Pick<TestEvidence,'fileId'|'objectKey'|'provider'>) {
 return snapshotEvidenceFromStored(rows).some(item=>item.fileId===evidence.fileId && (!evidence.objectKey || item.objectKey===evidence.objectKey) && (item.provider ?? 'google-drive')===(evidence.provider ?? 'google-drive'));
}
