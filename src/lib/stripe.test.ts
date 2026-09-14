import { afterEach, describe, expect, it } from "vitest";
import { platformCheckoutReturnUrls } from "./stripe-checkout";
import {
  getStripe,
  getStripePublishableKey,
  isStripeCheckoutConfigured,
  resetStripeClientForTests,
  STRIPE_CHECKOUT_UNAVAILABLE_CUSTOMER_MESSAGE,
  stripeMissingKeysMessage,
  appOriginFromHeaders,
} from "./stripe";

describe("stripe env helpers", () => {
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
    resetStripeClientForTests();
  });

  it("does not configure Checkout when secrets are missing", () => {
    expect(isStripeCheckoutConfigured()).toBe(false);
    expect(getStripe()).toBeNull();
    expect(stripeMissingKeysMessage()).toMatch(/Cloud Agent secrets or \.env\.local/);
  });

  it("keeps missing-keys copy off the customer Checkout message", () => {
    expect(STRIPE_CHECKOUT_UNAVAILABLE_CUSTOMER_MESSAGE).not.toMatch(/keys|STRIPE_|pending|env/i);
    expect(stripeMissingKeysMessage()).toMatch(/keys|STRIPE_|pending/i);
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

  it("prefers NEXT_PUBLIC_APP_URL for Connect return origins", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://todkc.com/";
    expect(appOriginFromHeaders(new Headers({ host: "localhost:3000" }))).toBe("https://todkc.com");
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(appOriginFromHeaders(new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }))).toBe(
      "http://localhost:3000",
    );
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
