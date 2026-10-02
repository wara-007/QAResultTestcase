import type { TestEvidence } from "./types";
import { evidenceSheetUrl } from "./evidence";

export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
export const EVIDENCE_ACCEPT = "image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
export function validateEvidenceFile(file: { type: string; size: number }) {
  const video = ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);
  if (!video && !file.type.startsWith("image/")) return "รองรับรูปภาพและวิดีโอ MP4, WebM, MOV เท่านั้น";
  if (file.size <= 0) return "ไฟล์ว่างเปล่า";
  if (file.size > (video ? VIDEO_MAX_BYTES : 10 * 1024 * 1024)) return `ไฟล์มีขนาดเกิน ${video ? 25 : 10} MB`;
  return "";
}
export function evidenceExtension(type: string) {
  return ({ "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "image/gif": "gif", "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" } as Record<string, string>)[type] ?? "image";
}
export function evidenceMimeFromUrl(url: string) {
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
  return ({ mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" } as Record<string, string>)[extension ?? ""] ?? "image/*";
}
export function evidenceSheetCell(evidence: TestEvidence) {
  const url = evidenceSheetUrl(evidence).replaceAll('"', '""');
  return evidence.mimeType.startsWith("video/") ? `=HYPERLINK("${url}","เปิดวิดีโอ")` : `=IMAGE("${url}",1)`;
}
