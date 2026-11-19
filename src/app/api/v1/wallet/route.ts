import { PLATFORM_FEE_PERCENT } from "@/core/constants/zibata";
import {
  createApiSupabaseClient,
  getOwnerProfileWithWallet,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function GET(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  const [profile, { data: transactions }] = await Promise.all([
    getOwnerProfileWithWallet(supabase, user),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return jsonResponse(
    {
      platformFeePercent: PLATFORM_FEE_PERCENT,
      wallet: {
        balanceMxn: profile?.wallet_balance_mxn ?? 0,
        pendingMxn: profile?.wallet_pending_mxn ?? 0,
        stripeConnectAccountId: profile?.stripe_connect_account_id ?? null,
        stripeConnectOnboarded: Boolean(profile?.stripe_connect_onboarded),
        payoutClabe: profile?.payout_clabe ?? null,
        payoutBank: profile?.payout_bank ?? null,
      },
      transactions: transactions ?? [],
    },
    { request }
  );
}
