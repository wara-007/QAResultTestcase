import { NextResponse } from "next/server";
import { destinationForRole, resolveAppRole } from "@/lib/app-session";
import { appOrigin } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = appOrigin(request.url);
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  const errorUrl = new URL("/auth/update-password", origin);
  if (password.length < 8) {
    errorUrl.searchParams.set("error", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    return NextResponse.redirect(errorUrl, 303);
  }
  if (password !== confirmation) {
    errorUrl.searchParams.set("error", "ยืนยันรหัสผ่านไม่ตรงกัน");
    return NextResponse.redirect(errorUrl, 303);
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email.toLowerCase() : "";
  if (!email) return NextResponse.redirect(new URL("/auth/login", origin), 303);
  const { error } = await supabase.auth.updateUser({ password, data: { password_configured: true } });
  if (error) {
    errorUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(errorUrl, 303);
  }
  const role = await resolveAppRole(supabase, email);
  if (!role) return NextResponse.redirect(new URL(`/auth/access-denied?email=${encodeURIComponent(email)}`, origin), 303);
  return NextResponse.redirect(new URL(destinationForRole(role, "/"), origin), 303);
}
