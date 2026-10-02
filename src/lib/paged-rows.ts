/** Read every page, failing rather than returning an incomplete dashboard. */
export async function readAllRows<T>(page: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const result = await page(start, start + 499);
    if (result.error) throw new Error(result.error.message);
    rows.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}
