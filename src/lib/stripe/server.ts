import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return Boolean(key && (key.startsWith("sk_test_") || key.startsWith("sk_live_") || key.startsWith("rk_")));
}

export function getStripeMode(): "live" | "test" | "unconfigured" {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return "unconfigured";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return "unconfigured";
}

export function isStripeLiveMode(): boolean {
  return getStripeMode() === "live";
}

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;

  if (!cachedStripe) {
    cachedStripe = new Stripe(secretKey, {
      typescript: true,
    });
  }
  return cachedStripe;
}

export function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}
