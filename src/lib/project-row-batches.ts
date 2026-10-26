/** Keep row-level permission checks and large execution payloads within one
 * statement's time budget. Do not start the next batch before the prior commit. */
export async function writeProjectRowBatches<T, R>(rows: readonly T[], write: (batch: T[]) => Promise<R[]>, batchSize = 5): Promise<R[]> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('Invalid project write batch size');
  const saved: R[] = [];
  for (let offset = 0; offset < rows.length; offset += batchSize) saved.push(...await write(rows.slice(offset, offset + batchSize)));
  return saved;
}
