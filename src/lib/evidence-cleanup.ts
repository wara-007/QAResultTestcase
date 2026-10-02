import type { TestEvidence } from './types';

/** Drive cleanup is best-effort; database/R2 deletion keeps its own errors. */
export async function cleanupGoogleWithWarning(cleanup:()=>Promise<number>) {
  try { return {deletedGoogleImages:await cleanup(),warnings:[] as string[]}; }
  catch { return {deletedGoogleImages:0,warnings:['ไม่สามารถตรวจหรือลบรูปใน Google ได้ครบ รูปที่เหลือยังอยู่ใน Google Drive กรุณาลบเองภายหลัง (Google Sheets ไม่ถูกลบ)']}; }
}

export function canDeleteGroup(userId: string, ownerId: string, systemOwner: boolean) {
  return Boolean(userId && (userId === ownerId || systemOwner));
}

export function collectGoogleEvidence(references: (string | null)[]): TestEvidence[] {
  const files = new Map<string, TestEvidence>();
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.evidence)) for (const item of record.evidence) {
      if (item && typeof item.fileId === 'string' && (!item.provider || item.provider === 'google-drive')) files.set(item.fileId,item);
    }
    for (const key of ['results','defects']) visit(record[key]);
  }
  for (const reference of references) if (reference?.startsWith('qa-results:')) {
    try { visit(JSON.parse(reference.slice(11))); } catch { /* Old free text has no structured files. */ }
  }
  return [...files.values()];
}

export function isOwnedGoogleEvidence(file: {mimeType?: string | null; name?: string | null; appProperties?: Record<string,string> | null}, projectId: string, legacyFolderVerified: boolean) {
  if (!file.mimeType?.startsWith('image/') && !file.mimeType?.startsWith('video/')) return false;
  const markedProject = file.appProperties?.qaProjectId;
  if (markedProject) return markedProject === projectId;
  return legacyFolderVerified && /^\d{13}-/.test(file.name ?? '');
}
