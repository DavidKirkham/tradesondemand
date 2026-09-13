import { afterEach, describe, expect, it } from "vitest";
import { platformCheckoutReturnUrls } from "./stripe-checkout";
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
    expect(stripeMissingKeysMessage()).toMatch(/Cloud Agent secrets or \.env\.local/);
  });

  it("defaults to the Trademark Walls publishable test key", () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    expect(getStripePublishableKey()).toBe(
      "pk_test_51UF1qLJOVLPQ6426SHn9n0iOGiePlgrUv0gZEW5Xf41nypWfrtYrae3McmrJxIIf7bu9pw4MCkJzAdH208EqacP600nPrKp2A0",
    );
  });

  it("ignores placeholder secret values", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    resetStripeClientForTests();
    expect(isStripeCheckoutConfigured()).toBe(false);
  });
});

describe("platformCheckoutReturnUrls", () => {
  it("returns booking success/retry URLs by default", () => {
    expect(platformCheckoutReturnUrls("https://todkc.com", "tok_abc")).toEqual({
      success_url: "https://todkc.com/book/success?token=tok_abc&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://todkc.com/book/retry?token=tok_abc",
    });
  });

  it("returns customer portal job URLs when paying from /account", () => {
    expect(
      platformCheckoutReturnUrls("https://todkc.com", "tok_abc", { publicId: "TOD-DEMO01" }),
    ).toEqual({
      success_url:
        "https://todkc.com/account/jobs/TOD-DEMO01?paid=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://todkc.com/account/jobs/TOD-DEMO01?canceled=1",
    });
  });
});
