import { confirmHandoverSchema } from "@/core/schemas/validation";
import {
  confirmOrderHandoverInDb,
  recordStripeTransferInDb,
} from "@/lib/stripe/finalize-order";
import { getStripeClient } from "@/lib/stripe/server";
import {
  createApiSupabaseClient,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { user } = await createApiSupabaseClient(request);

  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = confirmHandoverSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Ingresa un código de 6 dígitos." },
      { status: 400, request }
    );
  }

  const result = await confirmOrderHandoverInDb({
    orderId: id,
    sellerId: user.id,
    code: parsed.data.code,
  });

  if (!result.ok) {
    const code = result.error;
    if (code === "invalid_code") {
      return jsonResponse(
        {
          error: `Código incorrecto. Te quedan ${result.attempts_left ?? 0} intento(s).`,
          attempts_left: result.attempts_left ?? 0,
        },
        { status: 400, request }
      );
    }
    if (code === "max_attempts_exceeded") {
      return jsonResponse(
        {
          error: "Máximo de intentos excedido. Contacta soporte con tu orden.",
          attempts_left: 0,
        },
        { status: 429, request }
      );
    }
    if (code === "order_not_in_escrow") {
      return jsonResponse(
        { error: "Esta orden no tiene fondos pendientes en custodia." },
        { status: 409, request }
      );
    }
    return jsonResponse(
      { error: code === "order_not_found" ? "Orden no encontrada." : code ?? "Error confirmando entrega." },
      { status: code === "order_not_found" ? 404 : 500, request }
    );
  }

  let stripeTransferId: string | null = null;
  let transferNote: string | null = null;

  const payoutMxn = result.seller_payout_mxn ?? 0;
  const stripe = getStripeClient();

  if (
    !result.already_released &&
    result.stripe_connect_account_id &&
    result.stripe_connect_onboarded &&
    stripe &&
    payoutMxn > 0
  ) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(payoutMxn * 100),
        currency: "mxn",
        destination: result.stripe_connect_account_id,
        transfer_group: id,
        description: `Pago liberado zibataWear tras confirmar código de entrega #${id.slice(0, 8)}`,
      });
      stripeTransferId = transfer.id;
      await recordStripeTransferInDb({
        orderId: id,
        stripeTransferId: transfer.id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Saldo acreditado a tu billetera zibataWear";
      transferNote = `Saldo acreditado en tu Billetera zibataWear (${msg}).`;
    }
  }

  return jsonResponse(
    {
      ok: true,
      already_released: Boolean(result.already_released),
      order_status: result.order_status,
      payout_status: stripeTransferId ? "transferred_stripe" : result.payout_status,
      seller_payout_mxn: payoutMxn,
      stripe_transfer_id: stripeTransferId,
      transferNote,
    },
    { request }
  );
}
