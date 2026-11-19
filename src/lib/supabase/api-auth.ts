import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { extractEmailDomain, isUniversityEmail } from "@/core/constants/zibata";
import type { Profile } from "@/core/types/domain";
import { createServerSupabaseClient } from "./server";

export const PUBLIC_PROFILE_SELECT =
  "id, full_name, username, avatar_url, email_domain, university, major, campus_zone, bio, is_student_verified, is_demo, rating, reviews_count, created_at, updated_at";

export interface SellerWalletFields {
  wallet_balance_mxn: number;
  wallet_pending_mxn: number;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  payout_clabe: string | null;
  payout_bank: string | null;
}

const DEFAULT_SELLER_WALLET: SellerWalletFields = {
  wallet_balance_mxn: 0,
  wallet_pending_mxn: 0,
  stripe_connect_account_id: null,
  stripe_connect_onboarded: false,
  payout_clabe: null,
  payout_bank: null,
};

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

export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return existing as Profile;
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
    .select(PUBLIC_PROFILE_SELECT)
    .maybeSingle();

  return (inserted as Profile | null) ?? null;
}

export async function getOwnerSellerWallet(
  supabase: SupabaseClient,
  userId: string
): Promise<SellerWalletFields> {
  const { data } = await supabase
    .from("seller_wallets")
    .select(
      "wallet_balance_mxn, wallet_pending_mxn, stripe_connect_account_id, stripe_connect_onboarded, payout_clabe, payout_bank"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return { ...DEFAULT_SELLER_WALLET };
  }

  return {
    wallet_balance_mxn: data.wallet_balance_mxn ?? 0,
    wallet_pending_mxn: data.wallet_pending_mxn ?? 0,
    stripe_connect_account_id: data.stripe_connect_account_id ?? null,
    stripe_connect_onboarded: Boolean(data.stripe_connect_onboarded),
    payout_clabe: data.payout_clabe ?? null,
    payout_bank: data.payout_bank ?? null,
  };
}

export async function getOwnerProfileWithWallet(
  supabase: SupabaseClient,
  user: User
): Promise<Profile | null> {
  const [profile, wallet] = await Promise.all([
    ensureUserProfile(supabase, user),
    getOwnerSellerWallet(supabase, user.id),
  ]);

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    ...wallet,
  };
}
