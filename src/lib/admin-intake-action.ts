import {
  contractorOffersTrade,
} from "./admin-assign";
import { assignBookingToApprovedContractor } from "./admin-assign-action";
import {
  depositNoteForIntake,
  intakeDeposit,
  matchOrCreateIntakeCustomer,
  validateAdminIntakeInput,
  type AdminIntakeInput,
  type IntakeCustomer,
  type IntakeCustomerStore,
  type IntakeLastAddress,
  type ValidatedAdminIntake,
} from "./admin-intake";
import { parseTradeRatesJson } from "./contractor";
import { createPublicId, createToken } from "./booking";
import { createCustomerToken, createPaymentPublicId } from "./customer";
import { isValidEmail, isValidUsPhone, nationalUsDigits } from "./phone";
import { prisma } from "./prisma";

export type AdminIntakeResult =
  | {
      ok: true;
      booking: {
        id: string;
        publicId: string;
        status: string;
        contractorId: string | null;
        contractorName: string | null;
      };
      customer: { id: string; created: boolean };
      assigned: boolean;
      assignError?: string;
    }
  | { ok: false; status: 400 | 404; error: string; field?: string };

export type AdminIntakeLookup = {
  customer: IntakeCustomer;
  lastAddress: IntakeLastAddress | null;
};

export type AdminIntakeActionStore = IntakeCustomerStore & {
  findContractor: (id: string) => Promise<{
    id: string;
    status: string;
    tradesJson: string;
    businessName: string;
    phone: string;
    hourlyRateCents: number;
    minimumChargeCents: number;
    emergencyRateCents: number | null;
    tradeRatesJson: string;
  } | null>;
  findLastAddress: (customerId: string) => Promise<IntakeLastAddress | null>;
  createBooking: (data: ValidatedAdminIntake & {
    customerId: string;
    customerEmail: string;
    publicId: string;
    token: string;
    quoteSummary: string;
    depositAmountCents: number;
    depositNote: string;
    depositStatus: "PAID" | "PENDING";
    paymentPublicId: string;
  }) => Promise<{ id: string; publicId: string; status: string }>;
  assign: (
    bookingId: string,
    contractorId: string,
  ) => Promise<
    | {
        ok: true;
        booking: {
          id: string;
          publicId: string;
          status: string;
          contractorId: string | null;
          contractorName: string | null;
        };
      }
    | { ok: false; status: number; error: string }
  >;
};

function customerSelect() {
  return { id: true, name: true, email: true, phone: true } as const;
}

export function defaultAdminIntakeStore(): AdminIntakeActionStore {
  return {
    async findByPhone(phone) {
      return prisma.customer.findFirst({
        where: { phone },
        orderBy: { updatedAt: "desc" },
        select: customerSelect(),
      });
    },
    async findByEmail(email) {
      return prisma.customer.findUnique({
        where: { email },
        select: customerSelect(),
      });
    },
    async create(data) {
      return prisma.customer.create({
        data,
        select: customerSelect(),
      });
    },
    async update(id, data) {
      return prisma.customer.update({
        where: { id },
        data,
        select: customerSelect(),
      });
    },
    async findContractor(id) {
      return prisma.contractor.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          tradesJson: true,
          businessName: true,
          phone: true,
          hourlyRateCents: true,
          minimumChargeCents: true,
          emergencyRateCents: true,
          tradeRatesJson: true,
        },
      });
    },
    async findLastAddress(customerId) {
      const job = await prisma.booking.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        select: { street: true, city: true, state: true, zip: true },
      });
      return job;
    },
    async createBooking(data) {
      return prisma.booking.create({
        data: {
          trade: data.trade,
          problem: data.problem,
          urgency: data.urgency,
          street: data.street,
          city: data.city,
          state: data.state,
          zip: data.zip,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          quoteSummary: data.quoteSummary,
          contractorId: null,
          customerId: data.customerId,
          matchPreference: "FIRST_AVAILABLE",
          publicId: data.publicId,
          token: data.token,
          events: {
            create: {
              status: "RECEIVED",
              note:
                data.urgency === "emergency"
                  ? "Emergency phone intake — ticket opened"
                  : "Phone intake — ticket opened",
            },
          },
          payments: {
            create: {
              publicId: data.paymentPublicId,
              customerId: data.customerId,
              amountCents: data.depositAmountCents,
              type: "DEPOSIT",
              status: data.depositStatus,
              note: data.depositNote,
            },
          },
        },
        select: { id: true, publicId: true, status: true },
      });
    },
    assign: assignBookingToApprovedContractor,
  };
}

export async function lookupAdminIntakeClient(
  input: { phone?: string; email?: string },
  store: AdminIntakeActionStore = defaultAdminIntakeStore(),
): Promise<AdminIntakeLookup | null> {
  const phone = input.phone?.trim() ? nationalUsDigits(input.phone) : "";
  const email = input.email?.trim().toLowerCase() ?? "";

  let customer: IntakeCustomer | null = null;
  if (phone && isValidUsPhone(phone)) {
    customer = await store.findByPhone(phone);
  }
  if (!customer && email && isValidEmail(email)) {
    customer = await store.findByEmail(email);
  }
  if (!customer) return null;

  const lastAddress = await store.findLastAddress(customer.id);
  return { customer, lastAddress };
}

export async function createAdminPhoneJob(
  raw: AdminIntakeInput,
  store: AdminIntakeActionStore = defaultAdminIntakeStore(),
): Promise<AdminIntakeResult> {
  const parsed = validateAdminIntakeInput(raw);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.message, field: parsed.field };
  }

  const contractor = await store.findContractor(parsed.data.contractorId);
  if (!contractor || contractor.status !== "APPROVED") {
    return { ok: false, status: 400, error: "Pick an approved subcontractor.", field: "contractorId" };
  }
  if (!contractorOffersTrade(contractor.tradesJson, parsed.data.trade)) {
    return {
      ok: false,
      status: 400,
      error: "That shop is not licensed for this job's trade.",
      field: "contractorId",
    };
  }

  const { customer, created } = await matchOrCreateIntakeCustomer(
    {
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone,
      email: parsed.data.customerEmail,
      emailProvided: parsed.data.emailProvided,
      token: createCustomerToken(),
    },
    store,
  );

  const deposit = intakeDeposit({
    skipDeposit: parsed.data.skipDeposit,
    urgency: parsed.data.urgency,
    trade: parsed.data.trade,
    contractor: {
      hourlyRateCents: contractor.hourlyRateCents,
      minimumChargeCents: contractor.minimumChargeCents,
      emergencyRateCents: contractor.emergencyRateCents,
      tradeRates: parseTradeRatesJson(contractor.tradeRatesJson),
    },
  });

  const booking = await store.createBooking({
    ...parsed.data,
    customerId: customer.id,
    customerEmail: parsed.data.emailProvided ? parsed.data.customerEmail : customer.email,
    publicId: createPublicId(),
    token: createToken(),
    quoteSummary: `${parsed.data.quoteSummary} · ${deposit.summary} · phone dispatch`,
    depositAmountCents: deposit.amountCents,
    depositNote: depositNoteForIntake(deposit),
    depositStatus: deposit.amountCents === 0 ? "PAID" : "PENDING",
    paymentPublicId: createPaymentPublicId(),
  });

  const assigned = await store.assign(booking.id, contractor.id);
  if (!assigned.ok) {
    return {
      ok: true,
      booking: {
        id: booking.id,
        publicId: booking.publicId,
        status: booking.status,
        contractorId: null,
        contractorName: null,
      },
      customer: { id: customer.id, created },
      assigned: false,
      assignError: assigned.error,
    };
  }

  return {
    ok: true,
    booking: assigned.booking,
    customer: { id: customer.id, created },
    assigned: true,
  };
}
