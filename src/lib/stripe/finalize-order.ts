import { createClient } from "@supabase/supabase-js";
import { getStripeWebhookSecret } from "@/lib/stripe/server";

export interface FinalizeStripeOrderParams {
  orderId: string;
  listingId?: string | null;
  stripeSessionId: string;
  paymentIntentId: string | null;
  nextOrderStatus: "paid" | "active_rental" | "cancelled";
  nextListingStatus: "sold" | "rented" | null;
}

export async function finalizeStripeOrder({
  orderId,
  listingId,
  stripeSessionId,
  paymentIntentId,
  nextOrderStatus,
  nextListingStatus,
}: FinalizeStripeOrderParams): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    return { ok: false, error: "Falta NEXT_PUBLIC_SUPABASE_URL en el servidor." };
  }

  // Primary path when SUPABASE_SERVICE_ROLE_KEY is present in server env
  if (serviceRoleKey) {
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: orderErr } = await adminSupabase
      .from("orders")
      .update({
        status: nextOrderStatus,
        stripe_session_id: stripeSessionId,
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", orderId);

    if (orderErr) {
      return { ok: false, error: orderErr.message };
    }

    if (listingId && nextListingStatus && nextOrderStatus !== "cancelled") {
      const { error: listingErr } = await adminSupabase
        .from("listings")
        .update({ status: nextListingStatus })
        .eq("id", listingId);

      if (listingErr) {
        return { ok: false, error: listingErr.message };
      }
    }

    return { ok: true };
  }

  // Fallback path via Supabase Edge Function `stripe-order-sync` (authenticated with webhook proof)
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return {
      ok: false,
      error: "Falta SUPABASE_SERVICE_ROLE_KEY o STRIPE_WEBHOOK_SECRET para sincronizar la orden.",
    };
  }

  const edgeUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/stripe-order-sync`;
  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-zibata-webhook-proof": webhookSecret,
    },
    body: JSON.stringify({
      orderId,
      stripeSessionId,
      paymentIntentId,
      nextOrderStatus,
      nextListingStatus,
    }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: payload.error ?? `Error Edge Function (${res.status})`,
    };
  }

  return { ok: true };
}
