type PickerSessionDependencies = {
  authorize: (projectId?: string) => Promise<unknown>;
  config: () => { developerKey: string; appId: string };
  token: () => Promise<string>;
};

export async function pickerSessionResponse(request: Request, deps: PickerSessionDependencies) {
  const headers = { "Cache-Control": "no-store, private", Vary: "Cookie, Origin" };
  try {
    const origin = new URL(request.url).origin;
    if (request.headers.get("origin") !== origin) return Response.json({ error: "ไม่อนุญาตให้ขอสิทธิ์จากเว็บไซต์อื่น" }, { status: 403, headers });
    const body = await request.json() as { projectId?: unknown; returnTo?: unknown };
    if (body.projectId != null && (typeof body.projectId !== "string" || !body.projectId || body.projectId.length > 100)) return Response.json({ error: "Project ไม่ถูกต้อง" }, { status: 400, headers });
    await deps.authorize(body.projectId as string | undefined);
    const config = deps.config();
    const accessToken = await deps.token();
    if (!accessToken) throw new Error("ขอสิทธิ์ Google Picker ไม่สำเร็จ");
    return Response.json({ ...config, accessToken }, { headers });
  } catch (reason) {
    const error = reason as { status?: number; authUrl?: string };
    const status = error?.status && [400, 401, 403, 503].includes(error.status) ? error.status : 400;
    return Response.json({ error: reason instanceof Error ? reason.message : "เปิด Google Picker ไม่สำเร็จ", ...(error?.authUrl ? { authUrl: error.authUrl } : {}) }, { status, headers });
  }
}
