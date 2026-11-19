import { connection } from "next/server";
import { jsonResponse, handleCorsOptions } from "@/lib/supabase/api-auth";
import { isStripeConfigured } from "@/lib/stripe/server";

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function GET(request: Request) {
  await connection();
  return jsonResponse(
    {
      ok: true,
      app: "zibataWear",
      zone: "Zibatá, Querétaro",
      stripeConfigured: isStripeConfigured(),
      timestamp: new Date().toISOString(),
    },
    { request }
  );
}
