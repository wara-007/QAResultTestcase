import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { google } from "googleapis";

function startRoute(provider: "google" | "microsoft") {
  let state: Record<string, unknown> = {};
  let microsoftEmail = "";
  const localRequire = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL(`../app/api/${provider}/auth/start/route.ts`, import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const route = {exports: {} as {GET: (request: Request) => Promise<Response>}};
  const session = {sub: "qa-user", email: "login@gmail.com"};
  runInNewContext(compiled, {exports: route.exports, module: route, URL, Error, crypto: {randomUUID: () => "state"}, require(id: string) {
    if (id === "next/server") return {NextResponse: {
      redirect: (url: string) => Object.assign(new Response(null, {status: 307, headers: {location: String(url)}}), {cookies: {set: () => {}}}),
      json: (body: unknown, init: ResponseInit) => Response.json(body, init),
    }};
    if (id === "@/lib/supabase/server") return {createClient: async () => ({auth: {
      getClaims: async () => ({data: {claims: session}}),
      getUser: async () => ({data: {user: {id: session.sub, email: session.email}}}),
    }})};
    if (id === "@/lib/google-user-oauth") return {
      appOrigin: (url: string) => new URL(url).origin, safeReturnTo: (path: string) => path,
      googleOAuthClient: () => new google.auth.OAuth2("client", "secret", "https://app.test/callback"),
      GOOGLE_USER_SCOPES: ["drive"], GOOGLE_OAUTH_STATE_COOKIE: "google-state",
      sealGoogleToken: (value: Record<string, unknown>) => {state = value; return "sealed";},
    };
    if (id === "@/lib/microsoft-mail-server") return {
      beginMicrosoftMailConnection: async (userId: string, email: string, returnTo: string) => {
        microsoftEmail = email;
        return {url: "https://login.microsoftonline.com/authorize", state: {userId, senderEmail: email, returnTo}};
      },
      sealMicrosoftState: (value: Record<string, unknown>) => {state = value; return "sealed";},
      MICROSOFT_STATE_COOKIE: "microsoft-state",
    };
    if (id.startsWith("@/lib/")) return localRequire(`./${id.slice("@/lib/".length)}`);
    return localRequire(id);
  }});
  return {get: route.exports.GET, state: () => state, microsoftEmail: () => microsoftEmail};
}

test("Gmail consent selects edited sender and seals it with the initiating application user", async () => {
  const route = startRoute("google");
  const response = await route.get(new Request("https://app.test/api/google/auth/start?purpose=mail&senderEmail=Other%40Gmail.com&returnTo=/groups/project"));
  assert.equal(response.status, 307);
  const consent = new URL(response.headers.get("location")!);
  assert.equal(consent.searchParams.get("login_hint"), "other@gmail.com");
  assert.equal(route.state().senderEmail, "other@gmail.com");
  assert.equal(route.state().userId, "qa-user");
  assert.equal(route.state().returnTo, "/groups/project");
});

test("Microsoft consent accepts selected company mailbox even when app login uses Gmail", async () => {
  const route = startRoute("microsoft");
  const response = await route.get(new Request("https://app.test/api/microsoft/auth/start?senderEmail=other%40truecorp.co.th&returnTo=/groups/project"));
  assert.equal(response.status, 307);
  assert.equal(route.microsoftEmail(), "other@truecorp.co.th");
  assert.equal(route.state().userId, "qa-user");
  assert.equal(route.state().senderEmail, "other@truecorp.co.th");
});

test("mail consent rejects unsupported and wrong-provider addresses before redirecting", async () => {
  for (const [provider, email] of [["google", "other@example.com"], ["google", "other@truecorp.co.th"], ["microsoft", "other@gmail.com"]] as const) {
    const route = startRoute(provider);
    const response = await route.get(new Request(`https://app.test/api/${provider}/auth/start?purpose=mail&senderEmail=${encodeURIComponent(email)}`));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("location"), null);
  }
});
