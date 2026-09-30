import { loadSheetMappings, SheetMappingError } from "@/lib/sheet-mappings";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    return Response.json({ mappings: await loadSheetMappings(projectId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    const status = reason instanceof SheetMappingError ? reason.status : 400;
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลด Sheet mapping ไม่สำเร็จ" }, { status });
  }
}
