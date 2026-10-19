import 'server-only';
import { createClient } from './supabase/server';
import { readAllRows } from './paged-rows';
import { snapshotEvidenceMatches } from './snapshot-evidence';
import type { StoredCaseInput } from './project-sprint-snapshot';
import type { TestEvidence } from './types';

/** Retention is conservative: an unavailable schema/read must never authorize removal. */
export async function isEvidenceReferencedBySnapshot(projectId:string,evidence:TestEvidence):Promise<boolean> {
 try {
  const db=await createClient();
  const rows=await readAllRows((a,b)=>db.from('project_sprint_snapshot_cases').select('payload').eq('project_id',projectId).order('id').range(a,b));
  return snapshotEvidenceMatches(rows.map(r=>r.payload as StoredCaseInput),evidence);
 } catch {return true;}
}
