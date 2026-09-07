"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GOOGLE_USER_COOKIE } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(GOOGLE_USER_COOKIE);
  redirect("/auth/login");
}
