import type { TestEvidence } from "@/lib/types";

export function evidenceImageUrl(evidence: TestEvidence, legacyBasePath = "/api/google/evidence") {
  if (evidence.provider === "cloudflare-r2" && evidence.url) return evidence.url;
  return `${legacyBasePath}/${encodeURIComponent(evidence.fileId)}`;
}

export function evidenceSheetUrl(evidence: TestEvidence) {
  if (evidence.provider === "cloudflare-r2" && evidence.url) return evidence.url;
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(evidence.fileId)}&export=view`;
}
