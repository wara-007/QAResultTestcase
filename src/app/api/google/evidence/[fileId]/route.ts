import { serveSharedDriveEvidence } from "@/lib/shared-drive-evidence";
import { authorizeProjectDriveEvidence, loadCentralDriveEvidence } from "@/lib/shared-drive-evidence-server";
import { ProjectAccessError } from "@/lib/project-access-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await params;
    return await serveSharedDriveEvidence(fileId, () => authorizeProjectDriveEvidence(fileId), loadCentralDriveEvidence);
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลดรูปไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : 400, headers: { "Cache-Control": "no-store" } });
  }
}
