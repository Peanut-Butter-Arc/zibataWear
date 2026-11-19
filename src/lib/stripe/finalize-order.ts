import { createClient } from "@supabase/supabase-js";
import { getStripeWebhookSecret } from "@/lib/stripe/server";

export interface FinalizeStripeOrderParams {
  orderId: string;
  listingId?: string | null;
  stripeSessionId: string;
  paymentIntentId: string | null;
  nextOrderStatus: "paid" | "demo_paid" | "active_rental" | "cancelled";
  nextListingStatus: "sold" | "rented" | null;
}

interface EscrowActionResponse {
  ok?: boolean;
  updated?: boolean;
  already_released?: boolean;
  error?: string;
  attempts_left?: number;
  order_status?: string;
  payout_status?: string;
  seller_payout_mxn?: number;
  stripe_connect_account_id?: string | null;
  stripe_connect_onboarded?: boolean;
  remaining_balance_mxn?: number;
  transaction_id?: string;
}

async function invokeEscrowOperation(
  action:
    | "finalize"
    | "confirm_handover"
    | "record_transfer"
    | "confirm_return"
    | "save_connect_account"
    | "request_withdrawal",
  rpcName: string,
  rpcArgsWithoutSecret: Record<string, unknown>,
  edgePayload: Record<string, unknown>
): Promise<EscrowActionResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const webhookSecret = getStripeWebhookSecret();

  if (!supabaseUrl) {
    return { ok: false, error: "Falta NEXT_PUBLIC_SUPABASE_URL en el servidor." };
  }
  if (!webhookSecret) {
    return {
      ok: false,
      error: "Falta STRIPE_WEBHOOK_SECRET para autorizar la operación en custodia.",
    };
  }

  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc(rpcName, {
      p_webhook_secret: webhookSecret,
      ...rpcArgsWithoutSecret,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    if (typeof data === "object" && data !== null) {
      return data as EscrowActionResponse;
    }
    return { ok: true, updated: Boolean(data) };
  }

  const edgeUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/stripe-order-sync`;
  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-zibata-webhook-proof": webhookSecret,
    },
    body: JSON.stringify({ action, ...edgePayload }),
  });

  const payload = (await res.json().catch(() => ({}))) as EscrowActionResponse;
  if (!res.ok) {
    return {
      ok: false,
      error: payload.error ?? `Error Edge Function (${res.status})`,
    };
  }
  return payload;
}

export async function finalizeStripeOrder({
  orderId,
  listingId,
  stripeSessionId,
  paymentIntentId,
  nextOrderStatus,
  nextListingStatus,
}: FinalizeStripeOrderParams): Promise<{ ok: boolean; error?: string }> {
  // Demo fallback if Stripe webhook secret isn't configured locally
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret && serviceRoleKey && supabaseUrl) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin
      .from("orders")
      .update({
        status: nextOrderStatus,
        payout_status: nextOrderStatus === "cancelled" ? "unpaid" : "held_in_escrow",
        stripe_session_id: stripeSessionId,
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", orderId);
    if (error) return { ok: false, error: error.message };
    if (listingId && nextListingStatus && nextOrderStatus !== "cancelled") {
      await admin.from("listings").update({ status: nextListingStatus }).eq("id", listingId);
    }
    return { ok: true };
  }

  const result = await invokeEscrowOperation(
    "finalize",
    "finalize_stripe_order",
    {
      p_order_id: orderId,
      p_stripe_session_id: stripeSessionId,
      p_payment_intent_id: paymentIntentId,
      p_next_order_status: nextOrderStatus,
      p_next_listing_status: nextListingStatus,
    },
    {
      orderId,
      stripeSessionId,
      paymentIntentId,
      nextOrderStatus,
      nextListingStatus,
    }
  );
  return { ok: Boolean(result.ok), error: result.error };
}

export async function confirmOrderHandoverInDb(params: {
  orderId: string;
  sellerId: string;
  code: string;
}): Promise<EscrowActionResponse> {
  return invokeEscrowOperation(
    "confirm_handover",
    "confirm_order_handover",
    {
      p_order_id: params.orderId,
      p_seller_id: params.sellerId,
      p_code: params.code,
    },
    {
      orderId: params.orderId,
      sellerId: params.sellerId,
      code: params.code,
    }
  );
}

export async function recordStripeTransferInDb(params: {
  orderId: string;
  stripeTransferId: string;
}): Promise<EscrowActionResponse> {
  return invokeEscrowOperation(
    "record_transfer",
    "record_stripe_transfer",
    {
      p_order_id: params.orderId,
      p_stripe_transfer_id: params.stripeTransferId,
    },
    {
      orderId: params.orderId,
      stripeTransferId: params.stripeTransferId,
    }
  );
}

export async function confirmRentalReturnInDb(params: {
  orderId: string;
  actorId: string;
  code?: string;
}): Promise<EscrowActionResponse> {
  return invokeEscrowOperation(
    "confirm_return",
    "confirm_rental_return",
    {
      p_order_id: params.orderId,
      p_actor_id: params.actorId,
      p_code: params.code ?? null,
    },
    {
      orderId: params.orderId,
      actorId: params.actorId,
      code: params.code ?? null,
    }
  );
}

export async function saveStripeConnectAccountInDb(params: {
  userId: string;
  accountId: string;
  onboarded: boolean;
}): Promise<EscrowActionResponse> {
  return invokeEscrowOperation(
    "save_connect_account",
    "save_stripe_connect_account",
    {
      p_user_id: params.userId,
      p_account_id: params.accountId,
      p_onboarded: params.onboarded,
    },
    {
      userId: params.userId,
      accountId: params.accountId,
      onboarded: params.onboarded,
    }
  );
}

export async function requestWalletWithdrawalInDb(params: {
  userId: string;
  amountMxn: number;
  clabe: string;
  bank: string;
}): Promise<EscrowActionResponse> {
  return invokeEscrowOperation(
    "request_withdrawal",
    "request_wallet_withdrawal",
    {
      p_user_id: params.userId,
      p_amount_mxn: params.amountMxn,
      p_clabe: params.clabe,
      p_bank: params.bank,
    },
    {
      userId: params.userId,
      amountMxn: params.amountMxn,
      clabe: params.clabe,
      bank: params.bank,
    }
  );
}
