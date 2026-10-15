import test from "node:test";
import assert from "node:assert/strict";
import { workspaceReadyFirst, shouldFetchGoogleWorkspace } from "./workspace-loading";

test("saved cases become available without waiting for mapping or Google requests", async () => {
  let release!: () => void;
  const slowMapping = new Promise<void>(resolve => { release = resolve; });
  const published: string[] = [];
  const workspace = Promise.resolve({ cases: ["TC01"] });
  const done = workspaceReadyFirst(workspace, value => { published.push(...value.cases); }, [slowMapping]);
  await workspace;
  await Promise.resolve();
  assert.deepEqual(published, ["TC01"]);
  release();
  const [saved, mapping] = await done;
  assert.equal(saved.status, "fulfilled");
  assert.equal(mapping.status, "fulfilled");
});

test("saved project lists never fetch Google, including older imports without checkpoints", () => {
  assert.equal(shouldFetchGoogleWorkspace(true, false, false, true), false);
  assert.equal(shouldFetchGoogleWorkspace(true, false, false, false), false);
  assert.equal(shouldFetchGoogleWorkspace(false, false, false, false), true);
});

test("detail views fetch only missing or invalidated details", () => {
  assert.equal(shouldFetchGoogleWorkspace(true, true, true, false), false);
  assert.equal(shouldFetchGoogleWorkspace(true, true, false, false), true);
  assert.equal(shouldFetchGoogleWorkspace(true, true, true, true), true);
});

test("failed workspace loads do not publish empty data and retain the rejection", async () => {
  let published = false;
  const failure = new Error("Database unavailable");
  const [saved] = await workspaceReadyFirst(Promise.reject(failure), () => { published = true; }, []);
  assert.equal(published, false);
  assert.equal(saved.status, "rejected");
  if (saved.status === "rejected") assert.equal(saved.reason, failure);
});
