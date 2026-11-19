import { confirmReturnSchema } from "@/core/schemas/validation";
import { confirmRentalReturnInDb } from "@/lib/stripe/finalize-order";
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

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = confirmReturnSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Código de devolución inválido." },
      { status: 400, request }
    );
  }

  const result = await confirmRentalReturnInDb({
    orderId: id,
    actorId: user.id,
    code: parsed.data.code,
  });

  if (!result.ok) {
    const code = result.error;
    if (code === "invalid_return_code") {
      return jsonResponse(
        { error: "Código de devolución incorrecto. Pídeselo al vendedor." },
        { status: 400, request }
      );
    }
    if (code === "forbidden") {
      return jsonResponse({ error: "Sin permiso para confirmar esta renta." }, { status: 403, request });
    }
    return jsonResponse(
      { error: code ?? "No se pudo cerrar la renta." },
      { status: code === "order_not_found" ? 404 : 409, request }
    );
  }

  return jsonResponse(
    {
      ok: true,
      order_status: result.order_status ?? "completed",
    },
    { request }
  );
}
