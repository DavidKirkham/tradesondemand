import { afterEach, describe, expect, it } from "vitest";
import {
  getStripe,
  getStripePublishableKey,
  isStripeCheckoutConfigured,
  resetStripeClientForTests,
  stripeMissingKeysMessage,
} from "./stripe";

describe("stripe env helpers", () => {
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    resetStripeClientForTests();
  });

  it("does not configure Checkout when secrets are missing", () => {
    expect(isStripeCheckoutConfigured()).toBe(false);
    expect(getStripe()).toBeNull();
    expect(stripeMissingKeysMessage()).toMatch(/STRIPE_SECRET_KEY/);
  });

  it("accepts the Trademark Walls publishable test key", () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
      "pk_test_51UF1qLJOVLPQ6426SHn9n0iOGiePlgrUv0gZEW5Xf41nypWfrtYrae3McmrJxIIf7bu9pw4MCkJzAdH208EqacP600nPrKp2A0";
    expect(getStripePublishableKey()?.startsWith("pk_test_")).toBe(true);
  });

  it("ignores placeholder secret values", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    resetStripeClientForTests();
    expect(isStripeCheckoutConfigured()).toBe(false);
  });
});
