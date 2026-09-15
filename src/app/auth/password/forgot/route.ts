import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = appOrigin(request.url);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const url = new URL("/auth/forgot-password", origin);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    url.searchParams.set("error", "กรุณากรอกอีเมลให้ถูกต้อง");
    return NextResponse.redirect(url, 303);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
  });
  if (error) url.searchParams.set("error", error.message);
  else url.searchParams.set("sent", "1");
  return NextResponse.redirect(url, 303);
}
