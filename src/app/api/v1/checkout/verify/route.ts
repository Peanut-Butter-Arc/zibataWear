import { z } from "zod";
import { finalizeStripeOrder } from "@/lib/stripe/finalize-order";
import { getStripeClient } from "@/lib/stripe/server";
import {
  createApiSupabaseClient,
  handleCorsOptions,
  jsonResponse,
  PUBLIC_PROFILE_SELECT,
} from "@/lib/supabase/api-auth";

const ORDER_SELECT = `
  *,
  listing:listings!orders_listing_id_fkey(id, title, brand, images, size, meetup_zone),
  buyer:profiles!orders_buyer_id_fkey(${PUBLIC_PROFILE_SELECT}),
  seller:profiles!orders_seller_id_fkey(${PUBLIC_PROFILE_SELECT})
`;

const verifySchema = z.object({
  orderId: z.string().uuid("Orden inválida."),
  sessionId: z.string().min(1, "Falta sessionId de Stripe."),
});

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
    return jsonResponse({ error: "Stripe no está configurado." }, { status: 503, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
      { status: 400, request }
    );
  }

  const { orderId, sessionId } = parsed.data;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (orderErr || !order) {
    return jsonResponse({ error: "Orden no encontrada." }, { status: 404, request });
  }

  const shouldFinalize =
    order.payout_status !== "held_in_escrow" &&
    order.payout_status !== "released" &&
    order.payout_status !== "transferred_stripe";

  if (shouldFinalize) {
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo verificar la sesión en Stripe.";
      return jsonResponse({ error: msg }, { status: 502, request });
    }

    if (session.payment_status !== "paid") {
      return jsonResponse(
        { error: "El pago aún aparece pendiente en Stripe.", status: session.payment_status },
        { status: 409, request }
      );
    }

    if (
      session.metadata?.order_id !== orderId ||
      session.metadata?.buyer_id !== user.id
    ) {
      return jsonResponse(
        { error: "La sesión de Stripe no corresponde a esta orden." },
        { status: 403, request }
      );
    }

    const nextListingStatus = order.order_type === "rent" ? "rented" : "sold";

    const finalizeResult = await finalizeStripeOrder({
      orderId,
      listingId: order.listing_id,
      stripeSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      nextOrderStatus: "paid",
      nextListingStatus,
    });

    if (!finalizeResult.ok) {
      return jsonResponse(
        { error: finalizeResult.error ?? "No se pudo actualizar la orden tras verificar Stripe." },
        { status: 500, request }
      );
    }
  }

  const [{ data: updatedOrder }, { data: codeRow }] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .maybeSingle(),
    supabase
      .from("order_handover_codes")
      .select("code")
      .eq("order_id", orderId)
      .maybeSingle(),
  ]);

  return jsonResponse(
    {
      ok: true,
      order: {
        ...(updatedOrder ?? order),
        handover_code: codeRow?.code ?? null,
      },
    },
    { request }
  );
}
