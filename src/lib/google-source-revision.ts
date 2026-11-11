import { getProjectWorkbook } from './workbook-cache';
import { readGoogleRevisionStream, sheetRevisionStreamType } from './google-revision-stream';

/** A content-hash revision already required an export. Reuse those exact bytes
 * for the subsequent import instead of exporting the same workbook twice. */
export async function readGoogleSourceRevision(
  projectId: string, spreadsheetId: string, authorize: (url: string) => void, signal?: AbortSignal,
  options: { includeWorkbook?: boolean; knownRevision?: string } = {},
): Promise<string> {
  const query = new URLSearchParams({ revision: '1', stream: '1' });
  if (options.includeWorkbook !== false) query.set('includeWorkbook', '1');
  if (options.knownRevision) query.set('knownRevision', options.knownRevision);
  const response = await fetch(`/api/projects/${projectId}/google-sheet?${query}`, { cache: 'no-store', signal });
  const saveWorkbook = (revision: string, bytes: ArrayBuffer) =>
    getProjectWorkbook(`${projectId}:google:${spreadsheetId}:${revision}`, async () => bytes);
  const streamed = response.ok && response.headers.get('Content-Type') === sheetRevisionStreamType
    ? await readGoogleRevisionStream(response) : undefined;
  const revision = response.headers.get('X-Workbook-Revision');
  if (response.ok && revision?.startsWith('xlsx-v2:')
    && response.headers.get('Content-Type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    const bytes = await response.arrayBuffer();
    await saveWorkbook(revision, bytes);
    return revision;
  }
  const data = streamed ? streamed.frame : await response.json().catch(() => null) as { revision?: string; error?: string; authUrl?: string } | null;
  const status = streamed?.frame.status ?? response.status;
  if (status === 401 && data?.authUrl) {
    authorize(data.authUrl);
    throw new Error('กรุณาเชื่อมต่อ Google เพื่ออัปเดตข้อมูลล่าสุด');
  }
  if (status >= 400 || !response.ok || typeof data?.revision !== 'string' || !data.revision) {
    throw new Error(data?.error ?? `ตรวจการเปลี่ยนแปลงของ Sheets ไม่สำเร็จ (HTTP ${status}) กรุณาลองใหม่`);
  }
  if (streamed?.workbook && data.revision.startsWith('xlsx-v2:')) await saveWorkbook(data.revision, streamed.workbook);
  return data.revision;
}
