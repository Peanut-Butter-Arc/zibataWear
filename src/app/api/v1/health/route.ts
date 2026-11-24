import { connection } from "next/server";
import {
  PLATFORM_FEE_MIN_MXN,
  PLATFORM_FEE_PERCENT,
} from "@/core/constants/zibata";
import { jsonResponse, handleCorsOptions } from "@/lib/supabase/api-auth";
import {
  getStripeMode,
  isStripeConfigured,
  isStripeLiveMode,
} from "@/lib/stripe/server";

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
      stripeMode: getStripeMode(),
      livePaymentsEnabled: isStripeLiveMode(),
      platformFeePercent: PLATFORM_FEE_PERCENT,
      platformFeeMinMxn: PLATFORM_FEE_MIN_MXN,
      timestamp: new Date().toISOString(),
    },
    { request }
  );
}
