import { NextResponse } from "next/server";
import { destinationForRole, resolveAppRole } from "@/lib/app-session";
import { appOrigin, safeReturnTo } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = appOrigin(request.url);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeReturnTo(String(form.get("next") ?? ""));
  const loginUrl = new URL("/auth/login", origin);
  loginUrl.searchParams.set("next", next);

  if (!email || !password) {
    loginUrl.searchParams.set("error", "กรุณากรอกอีเมลและรหัสผ่าน");
    return NextResponse.redirect(loginUrl, 303);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    loginUrl.searchParams.set("error", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    return NextResponse.redirect(loginUrl, 303);
  }

  if (data.user.user_metadata?.password_configured !== true) {
    await supabase.auth.updateUser({ data: { password_configured: true } });
  }

  const role = await resolveAppRole(supabase, email);
  if (!role) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`/auth/access-denied?email=${encodeURIComponent(email)}`, origin), 303);
  }
  return NextResponse.redirect(new URL(destinationForRole(role, next), origin), 303);
}
