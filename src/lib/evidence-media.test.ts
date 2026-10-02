import assert from "node:assert/strict";
import test from "node:test";
import { validateEvidenceFile, evidenceSheetCell } from "./evidence-media";

test("accepts supported video at 25 MB and rejects oversized video", () => {
  assert.equal(validateEvidenceFile({ type: "video/mp4", size: 25 * 1024 * 1024 }), "");
  assert.match(validateEvidenceFile({ type: "video/mp4", size: 25 * 1024 * 1024 + 1 }), /25 MB/);
  assert.match(validateEvidenceFile({ type: "video/x-msvideo", size: 100 }), /MP4/);
});
test("keeps the existing image limit and rejects non-media uploads", () => {
  assert.equal(validateEvidenceFile({ type: "image/gif", size: 100 }), "");
  assert.match(validateEvidenceFile({ type: "image/png", size: 11 * 1024 * 1024 }), /10 MB/);
  assert.ok(validateEvidenceFile({ type: "text/html", size: 100 }));
});
test("Sheets renders images but links to video", () => {
  const base = { fileId: "a", name: "evidence", provider: "cloudflare-r2" as const, url: "https://media.example/a.mp4" };
  assert.equal(evidenceSheetCell({ ...base, mimeType: "video/mp4" }), '=HYPERLINK("https://media.example/a.mp4","เปิดวิดีโอ")');
  assert.equal(evidenceSheetCell({ ...base, mimeType: "image/png" }), '=IMAGE("https://media.example/a.mp4",1)');
});
