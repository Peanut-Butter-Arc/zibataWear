import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (searchParams.get("error") || searchParams.get("error_code")) {
    return NextResponse.redirect(`${origin}/auth?error=link_invalido`);
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const defaultNext =
    type === "recovery" ? "/auth/nueva-contrasena" : "/cuenta";
  const rawNext = searchParams.get("next") ?? defaultNext;
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : defaultNext;

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (tokenHash && type) {
    let { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error && (type === "signup" || type === "magiclink")) {
      const fallback = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: tokenHash,
      });
      error = fallback.error;
    }
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=link_invalido`);
}
