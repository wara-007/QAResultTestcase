import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ImportTimeoutError, withImportTimeout } from "./import-timeout";
import { readGoogleRevisionStream, streamGoogleRevision } from "./google-revision-stream";

function route(hang: "access" | "google" | null, streaming = false) {
  let signal: AbortSignal | undefined;
  let googleCalls = 0;
  class ProjectAccessError extends Error {}
  const dependencies: Record<string, unknown> = {
    "@/lib/project-access-server": { ProjectAccessError, requireProjectCapability: async () => {
      if (hang === "access") return new Promise(() => {});
      return { project: { google_sheet_id: "sheet" } };
    } },
    "@/lib/google-user-oauth": { getGoogleUserAuth: async () => ({}) },
    "@/lib/google-authorization": { needsGoogleAuthorization: () => false },
    "@/lib/google-revision-stream": { streamGoogleRevision },
    "@/lib/import-timeout": { ImportTimeoutError, withImportTimeout: (operation: (signal: AbortSignal) => Promise<unknown>, milliseconds: number, stage: string) => {
      assert.ok(streaming ? milliseconds > 30_000 && milliseconds < 60_000 : milliseconds > 0 && milliseconds < 30_000, "deadline must fit the hosting budget");
      return withImportTimeout(operation, 5, stage);
    } },
    "@/lib/google-sheets": Object.fromEntries(["readGoogleSheetRevision", "readGoogleSheetRevisionSnapshot"].map(name => [name, async (_id: string, _auth: unknown, input: AbortSignal) => {
      googleCalls++;
      signal = input;
      if (hang === "google") return new Promise(() => {});
      return name.endsWith("Snapshot") ? { revision: "drive:42" } : "drive:42";
    }])),
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../app/api/projects/[projectId]/google-sheet/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} as { GET: (req: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response> } };
  runInNewContext(compiled, { module: mod, exports: mod.exports, URL, Response, Error, AbortSignal, require: (id: string) => dependencies[id] ?? {} });
  return {
    get: async (include = false) => {
      let timer: ReturnType<typeof setTimeout>;
      try {
        return await Promise.race([
          mod.exports.GET(new Request(`http://localhost/api/projects/p/google-sheet?revision=1${include ? "&includeWorkbook=1" : ""}${streaming ? "&stream=1" : ""}`), { params: Promise.resolve({ projectId: "p" }) }),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("revision did not return within its deadline")), 200); }),
        ]);
      } finally { clearTimeout(timer!); }
    },
    signal: () => signal, googleCalls: () => googleCalls,
  };
}

test("a streamed timeout terminates the response and cancels Google work", async () => {
  const api = route("google", true);
  const result = await readGoogleRevisionStream(await api.get(true));
  assert.equal(result.frame.status, 504);
  assert.match(result.frame.error ?? "", /กรุณาลองใหม่/);
  assert.equal(api.signal()?.aborted, true);
});

for (const include of [false, true]) {
  test(`hung revision returns JSON 504 and cancels Google work (includeWorkbook=${include})`, async () => {
    const api = route("google");
    const response = await api.get(include);
    assert.equal(response.status, 504);
    assert.match(response.headers.get("Content-Type") ?? "", /application\/json/);
    assert.match((await response.json()).error, /กรุณาลองใหม่/);
    assert.equal(api.signal()?.aborted, true);
  });
  test(`revision deadline includes access checks (includeWorkbook=${include})`, async () => {
    const api = route("access");
    assert.equal((await api.get(include)).status, 504);
    assert.equal(api.googleCalls(), 0);
  });
  test(`successful revision returns the existing payload (includeWorkbook=${include})`, async () => {
    const api = route(null);
    const response = await api.get(include);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { revision: "drive:42" });
    assert.equal(api.signal()?.aborted, false);
  });
}
