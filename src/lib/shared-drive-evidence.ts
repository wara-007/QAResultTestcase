import { readAllRows } from "./paged-rows";

type EvidenceContainer = { evidence?: { fileId?: string; provider?: string }[]; defects?: EvidenceContainer[] };
type EvidenceCandidate = { project_id: string; result_reference: string | null };

/** Candidate text matches may precede the actual reference, so never truncate them. */
export async function storedDriveEvidenceProjectIds(
  fileId: string,
  page: (start: number, end: number) => PromiseLike<{ data: EvidenceCandidate[] | null; error: { message: string } | null }>,
): Promise<string[]> {
  const rows = await readAllRows(page);
  return [...new Set(rows.filter(row => storedDriveEvidenceMatches(row.result_reference, fileId)).map(row => row.project_id))];
}

/** A string match alone is not authorization: the ID must be an actual evidence reference. */
export function storedDriveEvidenceMatches(reference: string | null, fileId: string): boolean {
  if (!reference?.startsWith("qa-results:")) return false;
  try {
    const payload = JSON.parse(reference.slice("qa-results:".length));
    const containers: EvidenceContainer[] = [...(Array.isArray(payload.results) ? payload.results : []), ...(Array.isArray(payload.defects) ? payload.defects : [])];
    return containers.some(item => [...(Array.isArray(item?.evidence) ? item.evidence : []), ...(Array.isArray(item?.defects) ? item.defects.flatMap(defect => defect.evidence ?? []) : [])]
      .some(evidence => evidence?.fileId === fileId && (!evidence.provider || evidence.provider === "google-drive")));
  } catch { return false; }
}

export async function serveSharedDriveEvidence(
  fileId: string,
  authorize: () => Promise<void>,
  load: (fileId: string) => Promise<{ bytes: Uint8Array; mimeType: string }>,
) {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) throw new Error("Google Drive file ID ไม่ถูกต้อง");
  await authorize();
  const media = await load(fileId);
  if (!/^(image|video)\//.test(media.mimeType)) throw new Error("ไฟล์นี้ไม่ใช่ไฟล์หลักฐานรูปหรือวิดีโอ");
  return new Response(new Uint8Array(media.bytes), { headers: {
    "Content-Type": media.mimeType,
    // Re-check current access even after logout/revocation; never cache across viewers.
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
