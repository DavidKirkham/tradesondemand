import Stripe from "stripe";

/** Trademark Walls sandbox publishable key — safe on the client. Secrets stay in env only. */
export const DEFAULT_STRIPE_PUBLISHABLE_KEY =
  "pk_test_51UF1qLJOVLPQ6426SHn9n0iOGiePlgrUv0gZEW5Xf41nypWfrtYrae3McmrJxIIf7bu9pw4MCkJzAdH208EqacP600nPrKp2A0";

const PLACEHOLDER_SECRETS = new Set(["", "sk_test_xxx", "whsec_xxx"]);

export function getStripeSecretKey(): string | null {
  // Cloud Agent secrets, Vercel env, or .env.local — never a hardcoded secret.
  const value = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!value || PLACEHOLDER_SECRETS.has(value) || !value.startsWith("sk_")) return null;
  return value;
}

export function getStripePublishableKey(): string {
  const value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || DEFAULT_STRIPE_PUBLISHABLE_KEY;
  return value.startsWith("pk_") ? value : DEFAULT_STRIPE_PUBLISHABLE_KEY;
}

export function getStripeWebhookSecret(): string | null {
  // Cloud Agent secrets, Vercel env, or .env.local — never a hardcoded webhook secret.
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!value || PLACEHOLDER_SECRETS.has(value) || !value.startsWith("whsec_")) return null;
  return value;
}

export function isStripeCheckoutConfigured(): boolean {
  return Boolean(getStripeSecretKey());
}

/** Ops / server log only — never return this string to public customers. */
export function stripeMissingKeysMessage(): string {
  return "Stripe Checkout is not configured. Set STRIPE_SECRET_KEY in Cloud Agent secrets or .env.local (Trademark Walls sandbox — Stripe Dashboard → Developers → API keys). Booking still works; the TOD deposit stays pending until Checkout is enabled.";
}

/** Shown when Checkout cannot start. Does not mention keys, env, or pending deposits. */
export const STRIPE_CHECKOUT_UNAVAILABLE_CUSTOMER_MESSAGE =
  "Checkout is temporarily unavailable. Try again shortly or call dispatch.";

export function logStripeMissingKeys(context: string) {
  console.warn(`[stripe] ${context}: ${stripeMissingKeysMessage()}`);
}

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const secret = getStripeSecretKey();
  cached = secret ? new Stripe(secret) : null;
  return cached;
}

export function resetStripeClientForTests() {
  cached = undefined;
}

export function appOriginFromRequest(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export function checkoutPaymentType(kind: "deposit" | "minimum" | "balance"): string {
  return kind;
}
