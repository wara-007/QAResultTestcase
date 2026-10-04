import assert from "node:assert/strict";
import test from "node:test";
import { clearProjectWorkbook, getProjectWorkbook } from "./workbook-cache";

test("concurrent callers share one workbook request", async () => {
  clearProjectWorkbook("p1");
  let calls = 0;
  const loader = async () => { calls += 1; return new Uint8Array([1]).buffer; };
  await Promise.all([getProjectWorkbook("p1", loader), getProjectWorkbook("p1", loader)]);
  assert.equal(calls, 1);
});

test("failed request is removed so retry can succeed", async () => {
  clearProjectWorkbook("p2");
  let calls = 0;
  await assert.rejects(getProjectWorkbook("p2", async () => { calls += 1; throw new Error("offline"); }));
  const bytes = await getProjectWorkbook("p2", async () => { calls += 1; return new Uint8Array([2]).buffer; });
  assert.equal(new Uint8Array(bytes)[0], 2);
  assert.equal(calls, 2);
});

test("explicit refresh discards old workbook bytes but preserves other Projects", async () => {
  const old = await getProjectWorkbook("refresh", async () => new Uint8Array([1]).buffer);
  await getProjectWorkbook("other", async () => new Uint8Array([3]).buffer);
  clearProjectWorkbook("refresh");
  const fresh = await getProjectWorkbook("refresh", async () => new Uint8Array([2]).buffer);
  assert.notEqual(fresh, old);
  assert.equal(new Uint8Array(fresh)[0], 2);
  assert.equal(new Uint8Array(await getProjectWorkbook("other", async () => { throw new Error("must not download"); }))[0], 3);
});
