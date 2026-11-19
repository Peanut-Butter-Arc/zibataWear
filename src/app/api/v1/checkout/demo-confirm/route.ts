import { z } from "zod";
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

  const nextStatus = parsed.data.action === "cancel" ? "cancelled" : "demo_paid";

  const { data, error } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", parsed.data.orderId)
    .eq("buyer_id", user.id)
    .eq("payment_provider", "stripe_sandbox_demo")
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return jsonResponse(
      { error: "No pudimos actualizar la orden demo (puede estar ya procesada)." },
      { status: 404, request }
    );
  }

  return jsonResponse(
    {
      ok: true,
      order: data,
      redirectUrl:
        nextStatus === "demo_paid"
          ? `/pago/exito?orderId=${data.id}&mode=demo`
          : `/prenda/${data.listing_id}`,
    },
    { request }
  );
}
