import test from "node:test";
import assert from "node:assert/strict";
import { sealMailToken, openMailToken } from "./mail-token-crypto";

test("mail credentials round-trip encrypted and reject tampering or another key", () => {
  const value = {cache:"private-refresh-token",mailEmail:"qa@truecorp.co.th"};
  const secret = "a-long-random-secret-at-least-32-characters";
  const sealed = sealMailToken(value,secret);
  assert.doesNotMatch(sealed,/private-refresh-token/);
  assert.deepEqual(openMailToken(sealed,secret),value);
  assert.throws(() => openMailToken(sealed,"another-long-random-secret-at-least-32-characters"));
  const bytes = Buffer.from(sealed,"base64url"); bytes[20] ^= 1;
  assert.throws(() => openMailToken(bytes.toString("base64url"),secret));
  for (const key of ["", "short"]) assert.throws(() => sealMailToken(value,key));
});
