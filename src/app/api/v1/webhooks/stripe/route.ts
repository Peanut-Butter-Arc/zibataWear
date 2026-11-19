import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 }
    );
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    const listingId = session.metadata?.listing_id;
    const orderType = session.metadata?.order_type;

    if (orderId) {
      await adminSupabase
        .from("orders")
        .update({
          status: orderType === "rent" ? "active_rental" : "paid",
          stripe_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        })
        .eq("id", orderId);
    }

    if (listingId) {
      await adminSupabase
        .from("listings")
        .update({
          status: orderType === "rent" ? "rented" : "sold",
        })
        .eq("id", listingId);
    }
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      await adminSupabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId);
    }
  }

  return NextResponse.json({ received: true });
}
