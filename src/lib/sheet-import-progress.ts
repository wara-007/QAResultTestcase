import { loadRows, type RowLoadState } from './result-preview';

// Transient UI progress only. Persisted completion keeps the existing schema.
export function showSheetImportNotice(summary: { total: number; loaded: number }, saved: { complete: boolean; refreshRequired?: boolean }): boolean {
  if (saved.refreshRequired) return true;
  return !saved.complete && (summary.total === 0 || summary.loaded < summary.total);
}

export type SheetImportProgress = {
  phase: 'details' | 'text-saving' | 'workbook' | 'waiting-images' | 'images' | 'saving' | 'conflict';
  detailsSaved?: boolean;
  completed?: number;
  succeeded?: number;
  failed?: number;
  total?: number;
};

export function sheetImportAction(saved?: { complete: boolean; refreshRequired?: boolean; evidenceManifest?: unknown[] }) {
  if (saved && !saved.complete && !saved.refreshRequired && saved.evidenceManifest !== undefined) {
    return { resume:true, label:'นำเข้าส่วนที่เหลือต่อ', description:'ทำต่อจากไฟล์ที่บันทึกไว้ และตรวจรายการที่ยังไม่ครบ' };
  }
  if (saved && !saved.refreshRequired && saved.evidenceManifest === undefined) {
    return { resume:false, label:'ตรวจและนำเข้าหลักฐาน', description:'อ่านข้อมูลจาก Sheets และตรวจว่าผลทดสอบกับรูปถูกบันทึกครบ' };
  }
  return { resume:false, label:saved ? 'อัปเดตข้อมูลจาก Sheets' : 'นำเข้าข้อมูลจาก Sheets', description:'อ่านข้อมูลล่าสุดจาก Sheets พร้อมผลทดสอบและหลักฐาน' };
}

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

export function projectImportProgress(names: string[], states: Record<string, RowLoadState>, progress: Record<string, SheetImportProgress>, active: boolean, verified: boolean, expectedImages?: number, conflictPending = true) {
  const entries = Object.values(progress);
  const inventory = entries.filter(item => item.total !== undefined);
  // The manifest includes images in tabs whose text read failed. Wait for the
  // current transfer inventory before using it, so an old manifest cannot leak
  // into the preparation stage of a refresh.
  const imageTotal = inventory.length ? Math.max(expectedImages ?? 0, inventory.reduce((sum, item) => sum + (item.total ?? 0), 0)) : undefined;
  const uploaded = inventory.reduce((sum, item) => sum + (item.succeeded ?? 0), 0);
  const failedImages = inventory.reduce((sum, item) => sum + (item.failed ?? 0), 0);
  const summary = sheetImportSummary(names, states, progress);
  const ready = verified && !active;
  const stage: 'complete' | 'error' | 'conflict' | 'saving' | 'images' | 'details' | 'workbook' = ready ? 'complete'
    : conflictPending && entries.some(item => item.phase === 'conflict') ? 'conflict' : !active ? 'error'
    : imageTotal !== undefined ? (uploaded + failedImages >= imageTotal ? 'saving' : 'images')
    : entries.some(item => item.phase === 'details' || item.phase === 'text-saving') ? 'details' : 'workbook';
  return { ...summary, imageTotal, uploaded, failedImages, ready, stage };
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

/** Share one transfer budget across tabs and images; serialize DB checkpoints. */
export async function runSheetEvidenceImports<T>(
  tabs: string[], images: T[], sheetOf: (image: T) => string,
  importImage: (image: T) => Promise<boolean>,
  saveTab: (name: string, complete: boolean) => Promise<void>,
  progress: (name: string, value: SheetImportProgress) => void,
  state: (name: string, value: RowLoadState) => void,
  concurrency = 4,
) {
  const limit = Number.isFinite(concurrency) ? Math.max(1, Math.min(8, Math.floor(concurrency))) : 4;
  let active = 0;
  const waiting: Array<() => void> = [];
  const acquire = () => {
    if (active < limit) { active++; return Promise.resolve(); }
    return new Promise<void>(resolve => waiting.push(resolve));
  };
  const release = () => {
    const next = waiting.shift();
    if (next) next(); else active--;
  };
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
    let completed = 0, succeeded = 0, failed = 0;
    await loadRows(items.map((_, index) => String(index)), async key => {
      await acquire();
      try { if (await importImage(items[Number(key)])) succeeded++; else { complete = false; failed++; } }
      catch { complete = false; failed++; }
      finally { release(); }
      progress(name, { phase: 'images', completed: ++completed, succeeded, failed, total: items.length });
    }, () => {}, limit);
    progress(name, { phase: 'saving', completed, succeeded, failed, total: items.length });
    const saved = checkpoint.then(() => saveTab(name, complete));
    checkpoint = saved.catch(() => {}); // One failed checkpoint must not block other tabs.
    await saved;
    state(name, complete ? 'loaded' : 'error');
  }, (name, value) => {
    if (value === 'queued') progress(name, { phase: 'waiting-images', completed: 0, succeeded: 0, failed: 0, total: grouped.get(name)?.length ?? 0 });
    if (value === 'error') state(name, 'error');
  }, limit);
}
