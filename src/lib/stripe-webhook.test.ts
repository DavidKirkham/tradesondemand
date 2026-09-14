import { describe, expect, it } from "vitest";
import { checkoutPaymentWhere, paymentTypeFromMetadata } from "./stripe-webhook";

describe("paymentTypeFromMetadata", () => {
  it("maps Checkout kinds onto Payment.type", () => {
    expect(paymentTypeFromMetadata("balance")).toBe("BALANCE");
    expect(paymentTypeFromMetadata("deposit")).toBe("DEPOSIT");
    expect(paymentTypeFromMetadata("minimum")).toBe("DEPOSIT");
    expect(paymentTypeFromMetadata(undefined)).toBe("DEPOSIT");
  });
});

describe("checkoutPaymentWhere", () => {
  it("prefers Stripe ids then a pending row of the same type", () => {
    expect(
      checkoutPaymentWhere({
        sessionId: "cs_test_balance",
        intentId: "pi_test_balance",
        bookingId: "job_1",
        paymentType: "balance",
      }),
    ).toEqual({
      OR: [
        { stripeCheckoutSessionId: "cs_test_balance" },
        { stripePaymentIntentId: "pi_test_balance" },
        { bookingId: "job_1", type: "BALANCE", status: "PENDING" },
      ],
    });
  });

  it("does not fall back to a deposit when the session is a balance", () => {
    const where = checkoutPaymentWhere({
      bookingId: "job_1",
      paymentType: "balance",
    });
    expect(where.OR).toEqual([{ bookingId: "job_1", type: "BALANCE", status: "PENDING" }]);
    expect(JSON.stringify(where)).not.toContain("DEPOSIT");
  });
});
