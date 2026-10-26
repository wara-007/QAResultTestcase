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
