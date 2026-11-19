import { NextResponse } from "next/server";
import { finalizeStripeOrder } from "@/lib/stripe/finalize-order";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe/server";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook no configurado aún." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Falta stripe-signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Firma inválida";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    const listingId = session.metadata?.listing_id;
    const orderType = session.metadata?.order_type;

    if (orderId) {
      const result = await finalizeStripeOrder({
        orderId,
        listingId: listingId ?? null,
        stripeSessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        nextOrderStatus: orderType === "rent" ? "active_rental" : "paid",
        nextListingStatus: orderType === "rent" ? "rented" : "sold",
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? "No se pudo finalizar la orden." },
          { status: 500 }
        );
      }
    }
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      const result = await finalizeStripeOrder({
        orderId,
        listingId: session.metadata?.listing_id ?? null,
        stripeSessionId: session.id,
        paymentIntentId: null,
        nextOrderStatus: "cancelled",
        nextListingStatus: null,
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? "No se pudo cancelar la orden." },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
