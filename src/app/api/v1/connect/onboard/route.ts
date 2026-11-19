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

export async function POST(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonResponse(
      { error: "Stripe Connect aún no está configurado en el servidor." },
      { status: 503, request }
    );
  }

  const profile = await ensureUserProfile(supabase, user);
  let accountId: string | null = profile?.stripe_connect_account_id ?? null;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "MX",
        email: user.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        business_profile: {
          product_description:
            "Venta y renta circular de ropa universitaria en zibataWear",
        },
        metadata: {
          zibatawear_user_id: user.id,
        },
      });
      accountId = account.id;
      await saveStripeConnectAccountInDb({
        userId: user.id,
        accountId,
        onboarded: Boolean(account.payouts_enabled || account.details_submitted),
      });
    }

    const originHeader = request.headers.get("origin");
    const appOrigin = (
      originHeader ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin
    ).replace(/\/+$/, "");

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appOrigin}/cuenta?tab=billetera&connect=refresh`,
      return_url: `${appOrigin}/cuenta?tab=billetera&connect=return`,
      type: "account_onboarding",
    });

    return jsonResponse({ url: accountLink.url, accountId }, { request });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "No pudimos generar tu enlace de Stripe Connect.";
    return jsonResponse({ error: msg }, { status: 502, request });
  }
}
