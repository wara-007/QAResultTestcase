import { deleteSheetMapping, saveSheetMapping, SheetMappingError } from "@/lib/sheet-mappings";

function errorResponse(reason: unknown, fallback: string) {
  const status = reason instanceof SheetMappingError ? reason.status : 400;
  return Response.json({ error: reason instanceof Error ? reason.message : fallback }, { status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string; sheetId: string }> }) {
  try {
    const { projectId, sheetId } = await params;
    const body = await request.json() as { spreadsheetId?: string; sheetName?: string; testcaseKey?: string };
    const mapping = await saveSheetMapping(projectId, {
      spreadsheetId: body.spreadsheetId ?? "",
      sheetId: Number(sheetId),
      sheetName: body.sheetName ?? "",
      testcaseKey: body.testcaseKey ?? "",
    });
    return Response.json({ mapping });
  } catch (reason) {
    return errorResponse(reason, "บันทึก Sheet mapping ไม่สำเร็จ");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string; sheetId: string }> }) {
  try {
    const { projectId, sheetId } = await params;
    await deleteSheetMapping(projectId, Number(sheetId));
    return Response.json({ success: true });
  } catch (reason) {
    return errorResponse(reason, "ลบ Sheet mapping ไม่สำเร็จ");
  }
}
