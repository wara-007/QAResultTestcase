import assert from "node:assert/strict";
import test from "node:test";
import { storedDriveEvidenceMatches, storedDriveEvidenceProjectIds, serveSharedDriveEvidence } from "./shared-drive-evidence";

test("evidence authorization searches all candidate pages and ignores text-only matches", async () => {
  const fileId = "drive-file-123";
  const rows = [
    ...Array.from({ length: 501 }, () => ({ project_id: "text-only", result_reference: `qa-results:${JSON.stringify({ log: fileId })}` })),
    ...Array.from({ length: 2 }, () => ({ project_id: "evidence-project", result_reference: `qa-results:${JSON.stringify({ results: [{ evidence: [{ fileId }] }] })}` })),
  ];
  const pages: number[] = [];
  const projects = await storedDriveEvidenceProjectIds(fileId, async (start, end) => {
    pages.push(start);
    return { data: rows.slice(start, end + 1), error: null };
  });
  assert.deepEqual(projects, ["evidence-project"]);
  assert.deepEqual(pages, [0, 500]);
});

test("evidence authorization fails closed on a later candidate page error", async () => {
  await assert.rejects(storedDriveEvidenceProjectIds("drive-file-123", async start => start === 0
    ? { data: Array.from({ length: 500 }, () => ({ project_id: "project", result_reference: "" })), error: null }
    : { data: null, error: { message: "database unavailable" } }), /database unavailable/);
});

test("only exact Drive evidence references grant access, not arbitrary text or another provider", () => {
  const reference = (evidence: unknown) => `qa-results:${JSON.stringify({ results: [{ evidence: [evidence] }] })}`;
  assert.equal(storedDriveEvidenceMatches(reference({ fileId: "drive-file-123", provider: "google-drive" }), "drive-file-123"), true);
  assert.equal(storedDriveEvidenceMatches(reference({ fileId: "drive-file-123" }), "drive-file-123"), true);
  assert.equal(storedDriveEvidenceMatches(reference({ fileId: "drive-file-1234" }), "drive-file-123"), false);
  assert.equal(storedDriveEvidenceMatches(reference({ fileId: "drive-file-123", provider: "external-url" }), "drive-file-123"), false);
  assert.equal(storedDriveEvidenceMatches('qa-results:{"log":"drive-file-123"}', "drive-file-123"), false);
  assert.equal(storedDriveEvidenceMatches("qa-results:invalid", "drive-file-123"), false);
  assert.equal(storedDriveEvidenceMatches(`qa-results:${JSON.stringify({ defects: [{ evidence: [{ fileId: "drive-file-123" }] }] })}`, "drive-file-123"), true);
});

test("authorized viewer receives central-account image bytes without their own Google connection", async () => {
  let authorized = false;
  const response = await serveSharedDriveEvidence("drive-file-123", async () => { authorized = true; }, async id => {
    assert.equal(authorized, true);
    assert.equal(id, "drive-file-123");
    return { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/webp" };
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
});

test("unauthorized and invalid requests never read central Drive files", async () => {
  const load = async () => { assert.fail("must not read Drive"); };
  await assert.rejects(serveSharedDriveEvidence("drive-file-123", async () => { throw new Error("denied"); }, load), /denied/);
  await assert.rejects(serveSharedDriveEvidence("../unsafe", async () => { assert.fail("must not authorize invalid ID"); }, load), /ID/);
});

test("non-media Drive files cannot be served as active browser content", async () => {
  await assert.rejects(serveSharedDriveEvidence("drive-file-123", async () => {}, async () => ({ bytes: new Uint8Array([1]), mimeType: "text/html" })), /ไฟล์หลักฐาน/);
});
