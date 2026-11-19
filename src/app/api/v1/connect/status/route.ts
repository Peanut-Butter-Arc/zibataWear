import { saveStripeConnectAccountInDb } from "@/lib/stripe/finalize-order";
import { getStripeClient } from "@/lib/stripe/server";
import {
  createApiSupabaseClient,
  ensureUserProfile,
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

  const profile = await ensureUserProfile(supabase, user);
  const accountId: string | null = profile?.stripe_connect_account_id ?? null;

  if (!accountId) {
    return jsonResponse(
      {
        connected: false,
        onboarded: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      },
      { request }
    );
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonResponse(
      {
        connected: true,
        accountId,
        onboarded: Boolean(profile?.stripe_connect_onboarded),
        payoutsEnabled: Boolean(profile?.stripe_connect_onboarded),
        detailsSubmitted: Boolean(profile?.stripe_connect_onboarded),
      },
      { request }
    );
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const onboarded = Boolean(account.payouts_enabled || account.details_submitted);

    if (onboarded !== Boolean(profile?.stripe_connect_onboarded)) {
      await saveStripeConnectAccountInDb({
        userId: user.id,
        accountId,
        onboarded,
      });
    }

    return jsonResponse(
      {
        connected: true,
        accountId,
        onboarded,
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
      },
      { request }
    );
  } catch {
    return jsonResponse(
      {
        connected: true,
        accountId,
        onboarded: Boolean(profile?.stripe_connect_onboarded),
        payoutsEnabled: false,
        detailsSubmitted: Boolean(profile?.stripe_connect_onboarded),
      },
      { request }
    );
  }
}
