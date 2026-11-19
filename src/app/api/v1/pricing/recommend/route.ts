import { pricingRequestSchema } from "@/core/schemas/validation";
import { recommendClothingPricing } from "@/core/pricing/engine";
import { handleCorsOptions, jsonResponse } from "@/lib/supabase/api-auth";

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = pricingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400, request }
    );
  }

  const recommendation = recommendClothingPricing(parsed.data);
  return jsonResponse({ recommendation }, { request });
}
