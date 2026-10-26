/** Read every page, failing rather than returning an incomplete dashboard. */
export async function readAllRows<T>(page: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>, pageSize = 500, options: { shrinkOnTimeout?: boolean } = {}): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error('Invalid page size');
  const rows: T[] = [];
  let start = 0, size = pageSize;
  for (;;) {
    const result = await page(start, start + size - 1);
    if (result.error) {
      if (options.shrinkOnTimeout && size > 1 && (result.error.code === '57014' || /statement timeout/i.test(result.error.message))) {
        size = Math.max(1, Math.floor(size / 2));
        continue;
      }
      throw new Error(result.error.message);
    }
    rows.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < size) return rows;
    start += size;
  }
}

/** Bounded parallel reads keep small DB pages without serial network latency. */
export async function readAllRowsConcurrent<T>(
  page: (start: number, end: number) => PromiseLike<{data: T[] | null; error: {message: string; code?: string} | null}>,
  pageSize = 10, concurrency = 4,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Invalid page limits');
  const readRange = async (start: number, size: number): Promise<T[]> => {
    const result = await page(start, start + size - 1);
    if (result.error) {
      if (size > 1 && (result.error.code === '57014' || /statement timeout/i.test(result.error.message))) {
        const leftSize = Math.floor(size / 2);
        const left = await readRange(start, leftSize);
        return left.length < leftSize ? left : [...left, ...await readRange(start + leftSize, size - leftSize)];
      }
      throw new Error(result.error.message);
    }
    return result.data ?? [];
  };
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize * concurrency) {
    const batch = await Promise.allSettled(Array.from({length: concurrency}, (_,index) => readRange(offset + index * pageSize, pageSize)));
    for (const result of batch) {
      if (result.status === 'rejected') throw result.reason;
      rows.push(...result.value);
      // Speculative pages beyond the first short page are outside this result.
      if (result.value.length < pageSize) return rows;
    }
  }
}
