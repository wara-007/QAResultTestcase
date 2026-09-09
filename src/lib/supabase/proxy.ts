import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headersToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headersToSet) Object.entries(headersToSet).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const protectedPage = path === "/groups" || path.startsWith("/groups/") || path.startsWith("/admin/");
  const protectedApi = path.startsWith("/api/projects/") || path.startsWith("/api/google/evidence/");

  if (!signedIn && protectedApi) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  if (!signedIn && protectedPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (signedIn && (protectedPage || protectedApi)) {
    const { data: authorized, error: accessError } = await supabase.rpc("is_app_authorized");
    // Fail open only while the allowlist migration has not been installed yet.
    if (!accessError && authorized !== true) {
      if (protectedApi) return NextResponse.json({ error: "บัญชีนี้ยังไม่ได้รับอนุมัติให้ใช้งาน" }, { status: 403 });
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/auth/access-denied";
      deniedUrl.search = "";
      const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
      if (email) deniedUrl.searchParams.set("email", email);
      return NextResponse.redirect(deniedUrl);
    }
  }

  if (signedIn && path === "/auth/login") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/groups";
    destination.search = "";
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
