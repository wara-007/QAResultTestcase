// Shared across route mounts: navigation does not cancel an in-flight DB write.
const pending = new Map<string, Set<symbol>>();
const writeTails = new Map<string, Promise<void>>();

// save_test_case_result locks the Project row. Queue before starting network
// requests so a bulk import cannot consume the DB timeout waiting for itself.
export function enqueueProjectDetailWrite<T>(projectId: string, write: () => Promise<T>): Promise<T> {
  const result = (writeTails.get(projectId) ?? Promise.resolve()).then(write);
  const tail = result.then(() => {}, () => {});
  writeTails.set(projectId, tail);
  void tail.then(() => { if (writeTails.get(projectId) === tail) writeTails.delete(projectId); });
  return result;
}
export function beginProjectDetailRefresh(projectId: string) {
  const token = Symbol();
  const tasks = pending.get(projectId) ?? new Set<symbol>();
  tasks.add(token);
  pending.set(projectId, tasks);
  return () => {
    tasks.delete(token);
    if (!tasks.size && pending.get(projectId) === tasks) pending.delete(projectId);
  };
}
export function projectDetailRefreshPending(projectId: string) { return pending.has(projectId); }

export async function completeProjectDetailWrites<T>(writes: PromiseLike<T>[]): Promise<T[]> {
  const outcomes = await Promise.allSettled(writes);
  const failure = outcomes.find(outcome => outcome.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return outcomes.flatMap(outcome => outcome.status === "fulfilled" ? [outcome.value] : []);
}

/** Drain saves already accepted before an import starts reading its source snapshot. */
export async function waitForProjectDetailWrites(projectId: string): Promise<void> {
  while (writeTails.has(projectId)) await writeTails.get(projectId);
}

/** 57014 cancels and rolls back this RPC's transaction. Retry only that outcome;
 * permission, validation and connection errors must retain their original result. */
export async function retryTimedOutProjectWrite<T extends { error: { code?: string } | null }>(
  write: () => Promise<T>, wait: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await write();
    if (result.error?.code !== '57014' || attempt >= 2) return result;
    await wait((attempt + 1) * 500);
  }
}
