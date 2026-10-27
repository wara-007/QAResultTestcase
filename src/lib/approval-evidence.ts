import type { SheetImportState } from "./sheet-import-state";
import { normalizedCaseId } from "./sync/client-conflicts";

export type ApprovalEvidenceTarget = { testCaseId: string; sheetName: string; key: string };
type EvidenceCase = { id: string; results?: { sourceSheetName?: string; evidence: { name: string; fileId: string }[] }[] };
export async function importedEvidenceKey(image: { sheetName: string; row: number; column: number; bytes: Uint8Array }) {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(image.bytes));
  const identity = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  const targetHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([image.sheetName, image.row, image.column, identity])));
  // Leave room for the image suffix within Drive's 120-character upload name.
  return `sheet-proof-${Array.from(new Uint8Array(targetHash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
export function isEvidenceManifest(value: unknown): value is ApprovalEvidenceTarget[] {
  return Array.isArray(value) && value.length <= 10000 && value.every(item => item &&
    [item.testCaseId, item.sheetName, item.key].every(field => typeof field === "string" && field.length > 0 && field.length <= 1000))
    && new Set(value.map(item => JSON.stringify([item.testCaseId, item.sheetName, item.key]))).size === value.length;
}
export function approvalEvidenceReadiness(state: SheetImportState | undefined, cases: EvidenceCase[], tabs?: string[]) {
  const targets = state?.evidenceManifest ?? [];
  const missing = targets.filter(target => !cases.some(item => normalizedCaseId(item.id) === normalizedCaseId(target.testCaseId)
    && item.results?.some(result => result.sourceSheetName === target.sheetName && result.evidence.some(evidence => evidence.fileId.trim()
      && evidence.name.includes(`${target.key}-`)))));
  const persisted = targets.length - missing.length;
  const imported = !!state?.complete && !state.refreshRequired
    && (tabs ?? Object.keys(state.states)).every(name => state.states[name] === "loaded");
  const verified = isEvidenceManifest(state?.evidenceManifest);
  const ready = imported && verified && persisted === targets.length;
  return { ready, expected: targets.length, persisted, missing,
    reason: ready ? "นำเข้าหลักฐานครบแล้ว" : verified && missing.length ? `รูปหลักฐานยังบันทึกไม่ครบ ${persisted}/${targets.length} รายการ` : !imported ? "ยังนำเข้ารายละเอียดและรูปหลักฐานไม่ครบ"
      : !verified ? "ยังไม่ได้ตรวจการอัปโหลดรูปทั้งโปรเจค" : `รูปหลักฐานยังบันทึกไม่ครบ ${persisted}/${targets.length} รายการ` };
}

/** Recover a failed final acknowledgement using durable checkpoints and evidence.
 * Never use an old or invalidated workbook, or infer success from uploaded counts. */
export function canFinalizeSavedImport(state: SheetImportState | undefined, cases: EvidenceCase[], tabs: string[], revision: string): boolean {
  return !!state?.sourceRevision && state.sourceRevision === revision && !state.refreshRequired
    && approvalEvidenceReadiness({...state,complete:true},cases,tabs).ready;
}
