import { z } from "zod";
import { finalizeStripeOrder } from "@/lib/stripe/finalize-order";
import {
  createApiSupabaseClient,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

const demoConfirmSchema = z.object({
  orderId: z.string().uuid("Orden inválida."),
  action: z.enum(["confirm", "cancel"]).default("confirm"),
});

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function POST(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = demoConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Datos inválidos." }, { status: 400, request });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", parsed.data.orderId)
    .eq("buyer_id", user.id)
    .eq("payment_provider", "stripe_sandbox_demo")
    .eq("status", "pending")
    .maybeSingle();

  if (fetchErr || !existing) {
    return jsonResponse(
      { error: "No pudimos actualizar la orden demo (puede estar ya procesada)." },
      { status: 404, request }
    );
  }

  const isCancel = parsed.data.action === "cancel";
  const result = await finalizeStripeOrder({
    orderId: existing.id,
    listingId: existing.listing_id,
    stripeSessionId: `demo_${existing.id}`,
    paymentIntentId: null,
    nextOrderStatus: isCancel ? "cancelled" : "demo_paid",
    nextListingStatus: isCancel
      ? null
      : existing.order_type === "rent"
        ? "rented"
        : "sold",
  });

  if (!result.ok) {
    return jsonResponse(
      { error: result.error ?? "No se pudo confirmar la orden en custodia." },
      { status: 500, request }
    );
  }

  const { data: updated } = await supabase
    .from("orders")
    .select("*")
    .eq("id", existing.id)
    .maybeSingle();

  return jsonResponse(
    {
      ok: true,
      order: updated ?? existing,
      redirectUrl: isCancel
        ? `/prenda/${existing.listing_id}`
        : `/pago/exito?orderId=${existing.id}&mode=demo`,
    },
    { request }
  );
}
