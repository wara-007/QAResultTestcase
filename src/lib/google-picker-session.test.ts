import assert from "node:assert/strict";
import test from "node:test";
import { pickerSessionResponse } from "./google-picker-session";

const request = (origin = "http://localhost:3002") => new Request("http://localhost:3002/api/google/picker", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ projectId: "project-1", returnTo: "/groups" }) });
test("Picker token endpoint authenticates and checks project access before returning only an access token", async () => {
  const response = await pickerSessionResponse(request(), {
    authorize: async id => assert.equal(id, "project-1"),
    config: () => ({ developerKey: "browser-key", appId: "499875358182" }),
    token: async () => "short-lived-token",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store, private");
  assert.deepEqual(await response.json(), { developerKey: "browser-key", appId: "499875358182", accessToken: "short-lived-token" });
});
test("Picker endpoint denies cross-origin requests and unauthorized users without issuing tokens", async () => {
  const deps = { authorize: async () => { throw Object.assign(new Error("Denied"), { status: 403 }); }, config: () => { throw new Error("Must not read config"); }, token: async () => { throw new Error("Must not issue token"); } };
  assert.equal((await pickerSessionResponse(request("https://evil.example"), deps)).status, 403);
  const denied = await pickerSessionResponse(request(), deps);
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "Denied" });
});
