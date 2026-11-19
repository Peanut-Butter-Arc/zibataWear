import { withdrawWalletSchema } from "@/core/schemas/validation";
import { requestWalletWithdrawalInDb } from "@/lib/stripe/finalize-order";
import {
  createApiSupabaseClient,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function POST(request: Request) {
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

  const parsed = withdrawWalletSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Revisa el monto y tu CLABE." },
      { status: 400, request }
    );
  }

  const result = await requestWalletWithdrawalInDb({
    userId: user.id,
    amountMxn: parsed.data.amountMxn,
    clabe: parsed.data.clabe,
    bank: parsed.data.bank,
  });

  if (!result.ok) {
    return jsonResponse(
      {
        error:
          result.error === "insufficient_balance"
            ? "Saldo disponible insuficiente para este retiro."
            : result.error === "minimum_withdrawal_50"
              ? "El retiro mínimo es de $50 MXN."
              : result.error ?? "No se pudo solicitar el retiro.",
      },
      { status: 400, request }
    );
  }

  return jsonResponse(
    {
      ok: true,
      remaining_balance_mxn: result.remaining_balance_mxn ?? 0,
      transaction_id: result.transaction_id,
    },
    { status: 201, request }
  );
}
