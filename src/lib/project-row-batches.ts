/** Bound both row count and UTF-8 payload size: a few large Result snapshots
 * can exceed the database time budget even when the batch has only five rows. */
export async function writeProjectRowBatches<T, R>(rows: readonly T[], write: (batch: T[]) => Promise<R[]>, batchSize = 5): Promise<R[]> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('Invalid project write batch size');
  const maxBytes = 1024 * 1024;
  const encoder = new TextEncoder();
  const saved: R[] = [];
  let batch: T[] = [], bytes = 2;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).byteLength + 1;
    if (batch.length && (batch.length >= batchSize || bytes + size > maxBytes)) {
      saved.push(...await write(batch));
      batch = []; bytes = 2;
    }
    // A single oversized row stays intact and is sent alone; never truncate QA data.
    batch.push(row); bytes += size;
  }
  if (batch.length) saved.push(...await write(batch));
  return saved;
}
