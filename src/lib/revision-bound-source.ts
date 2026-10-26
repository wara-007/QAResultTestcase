import { WorkbookRevisionError } from './revision-checked-workbook';
import { checkpointSheetImport, type SheetImportState } from './sheet-import-state';
import type { RowLoadState } from './result-preview';
import type { WorkbookSource } from './types';

const changed = 'Sheets มีการเปลี่ยนแปลง กรุณาอัปเดตข้อมูลจาก Sheets ก่อนลองอีกครั้ง';

/** Text and workbook evidence must belong to the same captured revision. */
export async function revisionBoundSource(
  revision: string,
  cached: WorkbookSource | null | undefined,
  download: (revision: string) => Promise<ArrayBuffer>,
  parse: (bytes: ArrayBuffer) => WorkbookSource,
  readRevision: () => Promise<string>,
): Promise<WorkbookSource> {
  if (!revision) throw new WorkbookRevisionError(changed);
  if (cached?.bufferLoaded && cached.sourceOrigin === 'google-sheets'
    && cached.sheetImport?.sourceRevision === revision) {
    if (await readRevision() !== revision) throw new WorkbookRevisionError(changed);
    return cached;
  }
  // The download endpoint verifies this revision against the returned bytes.
  return parse(await download(revision));
}

export function revisionBoundCheckpoint(
  previous: SheetImportState | undefined, spreadsheetId: string,
  states: Record<string, RowLoadState>, at: string, revision: string,
): SheetImportState {
  if (!revision) throw new WorkbookRevisionError(changed);
  const same = previous?.spreadsheetId === spreadsheetId && previous.sourceRevision === revision;
  // Loaded tabs from an older workbook cannot establish readiness for this one.
  return { ...checkpointSheetImport(same ? previous : undefined, spreadsheetId, states, at,
    Boolean(same && previous?.complete && !previous.refreshRequired)), sourceRevision: revision };
}
