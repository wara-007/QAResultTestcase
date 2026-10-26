import assert from "node:assert/strict";
import test from "node:test";
import { DriveEvidenceFolders } from "./drive-evidence-folders";

const scope = { userId: "qa-a", projectId: "project-a", projectName: "Project A", testCaseId: "TC_01" };
test("concurrent image uploads share all three folder lookups", async () => {
  const folders = new DriveEvidenceFolders();
  const calls: string[] = [];
  const lookup = async (name: string, parent?: string) => { calls.push(`${parent ?? "root"}/${name}`); await new Promise(resolve => setImmediate(resolve)); return `id-${name}`; };
  const results = await Promise.all(Array.from({ length: 12 }, () => folders.resolve(scope, lookup)));
  assert.equal(new Set(results).size, 1);
  assert.equal(calls.length, 3);
  await folders.resolve(scope, lookup);
  assert.equal(calls.length, 3);
});
test("folder cache separates users and projects, expires, and invalidates failures", async () => {
  let now = 0; let calls = 0;
  const folders = new DriveEvidenceFolders({ ttlMs: 10, now: () => now });
  const lookup = async () => `id-${++calls}`;
  await folders.resolve(scope, lookup);
  await folders.resolve({ ...scope, projectId: "project-b" }, lookup);
  assert.equal(calls, 5); // root shared, project/case separate
  await folders.resolve({ ...scope, userId: "qa-b" }, lookup);
  assert.equal(calls, 8);
  now = 11;
  await folders.resolve(scope, lookup);
  assert.equal(calls, 11);
  folders.invalidate(scope.userId);
  await folders.resolve(scope, lookup);
  assert.equal(calls, 14);
  const broken = new DriveEvidenceFolders();
  await assert.rejects(broken.resolve(scope, async () => { throw new Error("missing folder"); }), /missing folder/);
  await broken.resolve(scope, lookup);
  assert.equal(calls, 17);
});
