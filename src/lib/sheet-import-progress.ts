import { loadRows, type RowLoadState } from './result-preview';

// Transient UI progress only. Persisted completion keeps the existing schema.
export type SheetImportProgress = {
  phase: 'details' | 'text-saving' | 'workbook' | 'waiting-images' | 'images' | 'saving' | 'conflict';
  detailsSaved?: boolean;
  completed?: number;
  total?: number;
};

export function sheetImportProgressLabel(state: RowLoadState | 'idle', progress?: SheetImportProgress): string {
  if (state === 'loaded') return '✓ โหลดแล้ว';
  if (state === 'error') return 'โหลดไม่สำเร็จ';
  if (state === 'idle') return 'ยังไม่ได้โหลดรายละเอียด';
  if (!progress) return state === 'queued' ? 'รอโหลด' : 'กำลังโหลดรายละเอียด';
  if (progress.phase === 'details') return 'กำลังโหลดรายละเอียด';
  if (progress.phase === 'text-saving') return 'กำลังบันทึกรายละเอียด';
  if (progress.phase === 'workbook') return progress.detailsSaved ? 'รายละเอียดบันทึกแล้ว · รอตรวจไฟล์รูป' : 'รายละเอียดพร้อม · รอไฟล์รูป';
  if (progress.phase === 'waiting-images') return 'รอนำเข้ารูป';
  if (progress.phase === 'saving') return 'กำลังบันทึก';
  if (progress.phase === 'conflict') return 'รอยืนยันข้อมูลที่ขัดแย้ง';
  return `นำเข้ารูป ${progress.completed ?? 0}/${progress.total ?? 0}`;
}

export function sheetImportSummary(names: string[], states: Record<string, RowLoadState>, progress: Record<string, SheetImportProgress>) {
  const tabs = [...new Set(names)];
  return {
    total: tabs.length,
    detailsSaved: tabs.filter(name => states[name] === 'loaded' || progress[name]?.detailsSaved).length,
    loaded: tabs.filter(name => states[name] === 'loaded').length,
    failed: tabs.filter(name => states[name] === 'error').length,
  };
}

/** Text checkpoints never wait for the workbook/evidence stage. */
export async function runSheetTextImports<T>(
  tabs: string[], read: (name: string) => Promise<T>, save: (name: string, value: T) => Promise<boolean | 'deferred'>,
  progress: (name: string, value: SheetImportProgress) => void,
  state: (name: string, value: RowLoadState) => void,
) {
  let checkpoint = Promise.resolve();
  return loadRows(tabs, async name => {
    const value = await read(name);
    progress(name, { phase: 'text-saving', detailsSaved: false });
    const saved = checkpoint.then(() => save(name, value));
    checkpoint = saved.then(() => {}, () => {});
    const persisted = await saved;
    progress(name, { phase: persisted !== false ? 'workbook' : 'conflict', detailsSaved: persisted === true });
    state(name, persisted !== false ? 'loading' : 'queued');
    return value;
  }, (name, value) => {
    if (value === 'loaded') return;
    if (value === 'loading') progress(name, { phase: 'details', detailsSaved: false });
    state(name, value);
  });
}

/** Upload different tabs concurrently, but serialize their shared DB snapshots. */
export async function runSheetEvidenceImports<T>(
  tabs: string[], images: T[], sheetOf: (image: T) => string,
  importImage: (image: T) => Promise<boolean>,
  saveTab: (name: string, complete: boolean) => Promise<void>,
  progress: (name: string, value: SheetImportProgress) => void,
  state: (name: string, value: RowLoadState) => void,
  concurrency = 3,
) {
  const grouped = new Map<string, T[]>();
  for (const image of images) {
    const name = sheetOf(image);
    const group = grouped.get(name) ?? [];
    group.push(image);
    grouped.set(name, group);
  }
  let checkpoint = Promise.resolve();
  const ordered = [...new Set(tabs)].sort((a, b) => (grouped.get(a)?.length ?? 0) - (grouped.get(b)?.length ?? 0));
  return loadRows(ordered, async name => {
    const items = grouped.get(name) ?? [];
    let complete = true;
    progress(name, { phase: 'images', completed: 0, total: items.length });
    for (let index = 0; index < items.length; index++) {
      try { if (!await importImage(items[index])) complete = false; }
      catch { complete = false; }
      progress(name, { phase: 'images', completed: index + 1, total: items.length });
    }
    progress(name, { phase: 'saving' });
    const saved = checkpoint.then(() => saveTab(name, complete));
    checkpoint = saved.catch(() => {}); // One failed checkpoint must not block other tabs.
    await saved;
    state(name, complete ? 'loaded' : 'error');
  }, (name, value) => {
    if (value === 'queued') progress(name, { phase: 'waiting-images' });
    if (value === 'error') state(name, 'error');
  }, concurrency);
}
