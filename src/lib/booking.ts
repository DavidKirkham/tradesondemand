import { randomBytes } from "node:crypto";
import { evaluateServiceArea } from "./kc-metro";
import { isValidEmail, isValidUsPhone } from "./phone";
import { getQuotePreview, quoteSummaryLine, type Urgency } from "./quotes";
import { isKnownTrade } from "./trades";

export const BOOKING_STATUSES = [
  "RECEIVED",
  "DISPATCHED",
  "EN_ROUTE",
  "ON_SITE",
  "COMPLETED",
  "CANCELLED",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingInput = {
  trade: string;
  problem: string;
  urgency: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  contractorId?: string;
  matchPreference?: string;
};

export type BookingValidation =
  | { ok: true; data: ValidatedBooking }
  | { ok: false; message: string; field?: string };

export type ValidatedBooking = {
  trade: string;
  problem: string;
  urgency: Urgency;
  street: string;
  city: string;
  state: "MO" | "KS";
  zip: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  quoteSummary: string;
  contractorId: string | null;
  matchPreference: "FIRST_AVAILABLE" | "SPECIFIC";
};

export function createPublicId(): string {
  return `TOD-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function createToken(): string {
  return randomBytes(18).toString("base64url");
}

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function validateBookingInput(input: BookingInput): BookingValidation {
  if (!isKnownTrade(input.trade)) {
    return { ok: false, field: "trade", message: "Choose a trade from the list, or Other." };
  }

  const problem = input.problem.trim();
  if (problem.length < 8) {
    return {
      ok: false,
      field: "problem",
      message: "Tell us what's going on in a sentence or two so dispatch can send the right tech.",
    };
  }

  if (input.urgency !== "emergency" && input.urgency !== "routine") {
    return { ok: false, field: "urgency", message: "Choose emergency or routine." };
  }

  const street = input.street.trim();
  if (street.length < 4) {
    return { ok: false, field: "street", message: "Add a street address so the tech can find you." };
  }

  const area = evaluateServiceArea({
    zip: input.zip,
    city: input.city,
    state: input.state,
  });
  if (!area.ok) {
    return { ok: false, field: "zip", message: area.message };
  }

  const customerName = input.customerName.trim();
  if (customerName.length < 2) {
    return { ok: false, field: "customerName", message: "We need a name for the job ticket." };
  }

  if (!isValidUsPhone(input.customerPhone)) {
    return { ok: false, field: "customerPhone", message: "Enter a 10-digit U.S. phone number." };
  }

  if (!isValidEmail(input.customerEmail)) {
    return { ok: false, field: "customerEmail", message: "Enter a working email for job updates." };
  }

  const urgency = input.urgency;
  const quote = getQuotePreview(input.trade, urgency);
  const contractorId = input.contractorId?.trim() || null;
  const matchPreference = contractorId ? "SPECIFIC" : "FIRST_AVAILABLE";

  return {
    ok: true,
    data: {
      trade: input.trade,
      problem,
      urgency,
      street,
      city: area.city,
      state: area.state,
      zip: area.zip,
      customerName,
      customerPhone: input.customerPhone.replace(/\D/g, "").slice(-10),
      customerEmail: input.customerEmail.trim().toLowerCase(),
      quoteSummary: quoteSummaryLine(quote),
      contractorId: matchPreference === "SPECIFIC" ? contractorId : null,
      matchPreference,
    },
  };
}

export function statusLabel(status: string): string {
  switch (status) {
    case "RECEIVED":
      return "Received";
    case "DISPATCHED":
      return "Dispatched";
    case "EN_ROUTE":
      return "En route";
    case "ON_SITE":
      return "On site";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function statusDetail(status: string, urgency: string): string {
  switch (status) {
    case "RECEIVED":
      return urgency === "emergency"
        ? "Dispatch has the ticket and is assigning a KC metro partner now. Keep your phone on."
        : "We've got the request. Dispatch will confirm a visit window.";
    case "DISPATCHED":
      return "A local partner accepted the job and will be in touch shortly.";
    case "EN_ROUTE":
      return "The tech is headed your way in the Kansas City metro.";
    case "ON_SITE":
      return "Someone is on site. Approve any extra work before it starts.";
    case "COMPLETED":
      return "Job marked complete. If an invoice was sent, pay the remaining balance to Trades on Demand in your account. If something still isn't right, call dispatch.";
    case "CANCELLED":
      return "This booking was cancelled. Call us if that was a mistake.";
    default:
      return "Status updated.";
  }
}
