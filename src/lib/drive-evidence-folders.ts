type Scope = { userId: string; projectId: string; projectName: string; testCaseId: string };
type Lookup = (name: string, parentId?: string) => Promise<string>;
type Entry = { userId: string; expiresAt: number; pending: Promise<string> };

/** Performance cache only: every upload must still authorize its user/project. */
export class DriveEvidenceFolders {
  private readonly entries = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  constructor(options: { ttlMs?: number; maxEntries?: number; now?: () => number } = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.maxEntries = Math.max(1, options.maxEntries ?? 1000);
    this.now = options.now ?? Date.now;
  }
  invalidate(userId: string) {
    for (const [key, entry] of this.entries) if (entry.userId === userId) this.entries.delete(key);
  }
  private get(userId: string, parts: string[], lookup: () => Promise<string>) {
    const key = JSON.stringify([userId, ...parts]);
    const found = this.entries.get(key);
    if (found && found.expiresAt > this.now()) return found.pending;
    this.entries.delete(key);
    const entry: Entry = { userId, expiresAt: this.now() + this.ttlMs, pending: Promise.resolve("") };
    entry.pending = Promise.resolve().then(lookup).then(id => {
      entry.expiresAt = this.now() + this.ttlMs;
      return id;
    }, reason => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw reason;
    });
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    return entry.pending;
  }
  async resolve(scope: Scope, lookup: Lookup) {
    const root = await this.get(scope.userId, ["root"], () => lookup("QA Result Evidence"));
    const project = await this.get(scope.userId, ["project", scope.projectId, scope.projectName, root], () => lookup(scope.projectName, root));
    return this.get(scope.userId, ["case", scope.projectId, scope.testCaseId, project], () => lookup(scope.testCaseId, project));
  }
}
