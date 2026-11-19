import { randomUUID } from "node:crypto";
import { PLATFORM_FEE_RATE } from "@/core/constants/zibata";
import { checkoutRequestSchema } from "@/core/schemas/validation";
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

function diffDaysInclusive(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00Z`).getTime();
  const end = new Date(`${endStr}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export async function POST(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse(
      { error: "Inicia sesión con tu código para comprar o rentar." },
      { status: 401, request }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
      { status: 400, request }
    );
  }

  await ensureUserProfile(supabase, user);

  const { listingId, orderType, rentalStartDate, rentalEndDate, meetupZone } = parsed.data;

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr || !listing) {
    return jsonResponse({ error: "Prenda no encontrada." }, { status: 404, request });
  }

  if (listing.status !== "active") {
    return jsonResponse(
      { error: "Esta prenda ya no está disponible en este momento." },
      { status: 409, request }
    );
  }

  if (listing.seller_id === user.id) {
    return jsonResponse(
      { error: "No puedes comprar ni rentar tu propia prenda." },
      { status: 400, request }
    );
  }

  if (orderType === "buy" && listing.listing_mode === "rent") {
    return jsonResponse(
      { error: "Esta prenda está disponible únicamente para renta." },
      { status: 400, request }
    );
  }

  if (orderType === "rent" && listing.listing_mode === "buy") {
    return jsonResponse(
      { error: "Esta prenda está disponible únicamente para compra." },
      { status: 400, request }
    );
  }

  let subtotalMxn = 0;
  let depositMxn = 0;
  let rentalDays: number | null = null;

  if (orderType === "buy") {
    if (!listing.sale_price_mxn || listing.sale_price_mxn <= 0) {
      return jsonResponse({ error: "Precio de venta no disponible." }, { status: 400, request });
    }
    subtotalMxn = listing.sale_price_mxn;
  } else {
    if (!listing.rent_price_per_day_mxn || listing.rent_price_per_day_mxn <= 0) {
      return jsonResponse({ error: "Tarifa de renta no disponible." }, { status: 400, request });
    }
    if (!rentalStartDate || !rentalEndDate) {
      return jsonResponse({ error: "Faltan fechas de renta." }, { status: 400, request });
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (rentalStartDate < todayStr) {
      return jsonResponse(
        { error: "La fecha de inicio no puede estar en el pasado." },
        { status: 400, request }
      );
    }
    rentalDays = diffDaysInclusive(rentalStartDate, rentalEndDate);
    if (rentalDays < 1 || rentalDays > 30) {
      return jsonResponse(
        { error: "La renta debe ser de entre 1 y 30 días." },
        { status: 400, request }
      );
    }
    subtotalMxn = listing.rent_price_per_day_mxn * rentalDays;
    depositMxn = listing.security_deposit_mxn ?? 0;
  }

  const serviceFeeMxn = Math.round(subtotalMxn * PLATFORM_FEE_RATE);
  const totalMxn = subtotalMxn + depositMxn + serviceFeeMxn;
  const chosenMeetupZone = meetupZone ?? listing.meetup_zone;

  const stripe = getStripeClient();
  const provider = stripe ? "stripe" : "stripe_sandbox_demo";
  const orderId = randomUUID();

  const originHeader = request.headers.get("origin");
  const requestOrigin =
    originHeader || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const appOrigin = requestOrigin.replace(/\/+$/, "");

  let stripeSessionId: string | null = null;
  let stripeSessionUrl: string | null = null;

  if (stripe) {
    try {
      const lineItems: Array<{
        price_data: {
          currency: "mxn";
          product_data: { name: string; description?: string; images?: string[] };
          unit_amount: number;
        };
        quantity: number;
      }> = [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name:
                orderType === "buy"
                  ? `${listing.title} (Compra)`
                  : `${listing.title} (Renta ${rentalDays} ${
                      rentalDays === 1 ? "día" : "días"
                    })`,
              description: `Entrega segura en ${chosenMeetupZone}`,
              images: listing.images?.[0] ? [listing.images[0]] : undefined,
            },
            unit_amount: subtotalMxn * 100,
          },
          quantity: 1,
        },
      ];

      if (depositMxn > 0) {
        lineItems.push({
          price_data: {
            currency: "mxn",
            product_data: {
              name: "Fianza de garantía reembolsable",
              description: "Se devuelve al entregar la prenda en buen estado",
            },
            unit_amount: depositMxn * 100,
          },
          quantity: 1,
        });
      }

      if (serviceFeeMxn > 0) {
        lineItems.push({
          price_data: {
            currency: "mxn",
            product_data: {
              name: "Protección Zibatá (5%)",
              description: "Resguardo del pago hasta tu entrega en campus",
            },
            unit_amount: serviceFeeMxn * 100,
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email ?? undefined,
        line_items: lineItems,
        metadata: {
          order_id: orderId,
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.seller_id,
          order_type: orderType,
        },
        success_url: `${appOrigin}/pago/exito?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appOrigin}/prenda/${listing.id}?checkout=cancelled`,
      });

      stripeSessionId = session.id;
      stripeSessionUrl = session.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error creando sesión de Stripe";
      return jsonResponse(
        { error: `Error con Stripe Checkout: ${msg}` },
        { status: 502, request }
      );
    }
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      id: orderId,
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      order_type: orderType,
      status: "pending",
      rental_start_date: orderType === "rent" ? rentalStartDate : null,
      rental_end_date: orderType === "rent" ? rentalEndDate : null,
      rental_days: rentalDays,
      subtotal_mxn: subtotalMxn,
      deposit_mxn: depositMxn,
      service_fee_mxn: serviceFeeMxn,
      total_mxn: totalMxn,
      meetup_zone: chosenMeetupZone,
      stripe_session_id: stripeSessionId,
      payment_provider: provider,
    })
    .select("*")
    .single();

  if (orderErr || !order) {
    return jsonResponse(
      { error: "No se pudo crear la orden.", details: orderErr?.message },
      { status: 500, request }
    );
  }

  if (stripeSessionUrl) {
    return jsonResponse(
      {
        order,
        checkoutUrl: stripeSessionUrl,
        mode: "stripe_live_or_test",
      },
      { status: 201, request }
    );
  }

  return jsonResponse(
    {
      order,
      checkoutUrl: `/pago/sandbox?orderId=${order.id}`,
      mode: "stripe_sandbox_demo",
    },
    { status: 201, request }
  );
}
