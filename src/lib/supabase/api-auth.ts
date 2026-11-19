import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { extractEmailDomain, isUniversityEmail } from "@/core/constants/zibata";
import { createServerSupabaseClient } from "./server";

export function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function jsonResponse<T>(
  data: T,
  init: { status?: number; request?: Request } = {}
) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: corsHeaders(init.request),
  });
}

export function handleCorsOptions(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export interface ApiAuthResult {
  supabase: SupabaseClient;
  user: User | null;
}

/**
 * Supports both native mobile clients (`Authorization: Bearer <jwt>`)
 * and Web browsers (SSR cookies via @supabase/ssr).
 */
export async function createApiSupabaseClient(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      return { supabase, user: user ?? null };
    }
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user ?? null };
}

export async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const email = user.email ?? "";
  const emailDomain = extractEmailDomain(email);
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  const { data: inserted } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      full_name: fullName,
      email_domain: emailDomain,
      is_student_verified: isUniversityEmail(email),
      is_demo: false,
    })
    .select("*")
    .maybeSingle();

  return inserted;
}
