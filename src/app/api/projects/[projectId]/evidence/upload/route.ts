import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { requireProjectCapability, ProjectAccessError } from "@/lib/project-access-server";
import { evidenceExtension, validateEvidenceFile } from "@/lib/evidence-media";
import { getR2Config, inspectR2Object, presignR2Upload } from "@/lib/r2";

type Ticket = { projectId: string; userId: string; key: string; name: string; type: string; size: number; expires: number };
const signature = (body: string) => createHmac("sha256", process.env.R2_SECRET_ACCESS_KEY!).update(body).digest();
const encodeTicket = (data: Ticket) => {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${signature(body).toString("base64url")}`;
};
function decodeTicket(value: string): Ticket {
  const [body, signed] = value.split(".");
  if (!body || !signed) throw new Error("Upload ticket ไม่ถูกต้อง");
  const expected = signature(body), actual = Buffer.from(signed, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Upload ticket ไม่ถูกต้อง");
  const ticket = JSON.parse(Buffer.from(body, "base64url").toString()) as Ticket;
  if (ticket.expires < Date.now()) throw new Error("หมดเวลาอัปโหลด กรุณาลองอีกครั้ง");
  return ticket;
}
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const access = await requireProjectCapability(projectId, "edit");
    if (!getR2Config()) throw new Error("กรุณาตั้งค่า Cloudflare R2 เพื่ออัปโหลดวิดีโอ");
    const input = await request.json();
    const size = Number(input.size), type = String(input.type ?? ""), name = String(input.name ?? "").slice(0, 160);
    const invalid = validateEvidenceFile({ type, size });
    if (!Number.isSafeInteger(size) || invalid) throw new Error(invalid || "ขนาดไฟล์ไม่ถูกต้อง");
    const testCaseId = String(input.testCaseId ?? "").trim();
    if (!testCaseId || testCaseId.length > 160) throw new Error("Test Case ID ไม่ถูกต้อง");
    const key = `projects/${projectId}/${testCaseId.replace(/[^a-zA-Z0-9._-]+/g, "_")}/${randomUUID()}.${evidenceExtension(type)}`;
    const uploadUrl = await presignR2Upload(key, type, size);
    return Response.json({ uploadUrl, ticket: encodeTicket({ projectId, userId: access.userId, key, type, size, name, expires: Date.now() + 15 * 60_000 }) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "เตรียม Upload ไม่สำเร็จ" }, { status: error instanceof ProjectAccessError ? error.status : 400 });
  }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const access = await requireProjectCapability(projectId, "edit");
    const config = getR2Config();
    if (!config) throw new Error("ยังไม่ได้ตั้งค่า Cloudflare R2");
    const { ticket: value } = await request.json();
    const ticket = decodeTicket(String(value));
    if (ticket.projectId !== projectId || ticket.userId !== access.userId) throw new ProjectAccessError("Upload ticket ไม่ใช่ของผู้ใช้นี้", 403);
    const actual = await inspectR2Object(ticket.key);
    if (actual.ContentLength !== ticket.size || actual.ContentType !== ticket.type) throw new Error("ไฟล์ที่อัปโหลดไม่ตรงกับไฟล์ที่เลือก");
    return Response.json({ evidence: { fileId: ticket.key.split("/").pop()!, objectKey: ticket.key, provider: "cloudflare-r2", url: `${config.publicBaseUrl}/${ticket.key.split("/").map(encodeURIComponent).join("/")}`, name: ticket.name, mimeType: ticket.type } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "ตรวจสอบ Upload ไม่สำเร็จ" }, { status: error instanceof ProjectAccessError ? error.status : 400 });
  }
}
