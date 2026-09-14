import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminIntakeActionStore } from "./admin-intake-action";
import { createAdminPhoneJob, lookupAdminIntakeClient } from "./admin-intake-action";
import type { IntakeCustomer } from "./admin-intake";

const input = {
  trade: "plumbing",
  problem: "Water heater leaking into the basement utility room.",
  urgency: "emergency",
  street: "4800 Main St",
  city: "Kansas City",
  state: "MO",
  zip: "64112",
  customerName: "Jordan Hale",
  customerPhone: "8165550199",
  customerEmail: "",
  contractorId: "shop_1",
  skipDeposit: true,
};

const shop = {
  id: "shop_1",
  status: "APPROVED",
  tradesJson: JSON.stringify(["plumbing", "hvac"]),
  businessName: "Waldo Heat & Pipe",
  phone: "8165550100",
  hourlyRateCents: 12000,
  minimumChargeCents: 18900,
  emergencyRateCents: 22000,
  tradeRatesJson: "[]",
};

function store(overrides: Partial<AdminIntakeActionStore> = {}): AdminIntakeActionStore & {
  createdBookings: unknown[];
  assigned: { bookingId: string; contractorId: string }[];
} {
  const createdBookings: unknown[] = [];
  const assigned: { bookingId: string; contractorId: string }[] = [];
  const customers: IntakeCustomer[] = [];
  const base: AdminIntakeActionStore = {
    async findByPhone(phone) {
      return customers.find((row) => row.phone === phone) ?? null;
    },
    async findByEmail(email) {
      return customers.find((row) => row.email === email) ?? null;
    },
    async create(data) {
      const row = { id: "cus_new", name: data.name, email: data.email, phone: data.phone };
      customers.push(row);
      return row;
    },
    async update(id, data) {
      const current = customers.find((row) => row.id === id);
      const row = { id, name: data.name ?? current?.name ?? "", email: data.email ?? current?.email ?? "", phone: data.phone ?? current?.phone ?? "" };
      return row;
    },
    async findContractor(id) {
      return id === shop.id ? shop : null;
    },
    async findLastAddress() {
      return { street: "4800 Main St", city: "Kansas City", state: "MO", zip: "64112" };
    },
    async createBooking(data) {
      createdBookings.push(data);
      return { id: "job_1", publicId: data.publicId, status: "RECEIVED" };
    },
    async assign(bookingId, contractorId) {
      assigned.push({ bookingId, contractorId });
      return {
        ok: true as const,
        booking: {
          id: bookingId,
          publicId: "TOD-PHONE1",
          status: "DISPATCHED",
          contractorId,
          contractorName: "Waldo Heat & Pipe",
        },
      };
    },
  };
  return Object.assign(base, overrides, { createdBookings, assigned });
}

describe("createAdminPhoneJob", () => {
  it("creates the ticket then assigns through the existing admin assign path", async () => {
    const db = store();
    const result = await createAdminPhoneJob(input, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assigned).toBe(true);
    expect(result.booking.status).toBe("DISPATCHED");
    expect(result.booking.contractorName).toBe("Waldo Heat & Pipe");
    expect(result.booking.publicId).toMatch(/^TOD-/);
    expect(db.assigned).toEqual([{ bookingId: "job_1", contractorId: "shop_1" }]);
    const created = db.createdBookings[0] as { depositAmountCents: number; contractorId?: string; skipDeposit?: boolean };
    expect(created.depositAmountCents).toBe(0);
  });

  it("rejects a shop that does not offer the trade before creating a job", async () => {
    const db = store({
      async findContractor() {
        return { ...shop, tradesJson: JSON.stringify(["painting"]) };
      },
    });
    const result = await createAdminPhoneJob(input, db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/trade/i);
    expect(db.createdBookings).toHaveLength(0);
    expect(db.assigned).toHaveLength(0);
  });

  it("keeps the job when assign fails after create", async () => {
    const db = store({
      async assign() {
        return { ok: false as const, status: 400, error: "Could not assign that job." };
      },
    });
    const result = await createAdminPhoneJob(input, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assigned).toBe(false);
    expect(result.assignError).toMatch(/assign/i);
    expect(result.booking.publicId).toMatch(/^TOD-/);
    expect(db.createdBookings).toHaveLength(1);
  });
});

describe("lookupAdminIntakeClient", () => {
  it("returns the phone match and last job address", async () => {
    const existing: IntakeCustomer = {
      id: "cus_1",
      name: "Jordan Hale",
      email: "jordan@home.example",
      phone: "8165550199",
    };
    const db = store({
      async findByPhone() {
        return existing;
      },
    });
    const result = await lookupAdminIntakeClient({ phone: "(816) 555-0199" }, db);
    expect(result?.customer.id).toBe("cus_1");
    expect(result?.lastAddress?.zip).toBe("64112");
  });

  it("returns null when nothing matches", async () => {
    const result = await lookupAdminIntakeClient({ phone: "8165550000" }, store());
    expect(result).toBeNull();
  });
});

describe("createAdminPhoneJob validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a field error without touching the store when the ticket is incomplete", async () => {
    const db = store();
    const result = await createAdminPhoneJob({ ...input, problem: "help" }, db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("problem");
    expect(db.createdBookings).toHaveLength(0);
  });
});
