import { describe, expect, it } from "vitest";
import {
  composeIntakeProblem,
  depositNoteForIntake,
  filterContractorsByQuery,
  intakeDeposit,
  isPhonePlaceholderEmail,
  matchOrCreateIntakeCustomer,
  partitionIntakeContractors,
  phonePlaceholderEmail,
  pickMatchingIntakeCustomer,
  validateAdminIntakeInput,
  type AdminIntakeContractorOption,
  type IntakeCustomer,
  type IntakeCustomerStore,
} from "./admin-intake";

const base = {
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
};

const shop = (
  overrides: Partial<AdminIntakeContractorOption> & Pick<AdminIntakeContractorOption, "id" | "businessName" | "trades" | "serviceArea">,
): AdminIntakeContractorOption => ({
  publicId: `PRO-${overrides.id}`,
  hourlyRateCents: 12000,
  minimumChargeCents: 18900,
  emergencyRateCents: 22000,
  tradeRates: [],
  phone: "8165550100",
  tradesJson: JSON.stringify(overrides.trades),
  ...overrides,
});

describe("validateAdminIntakeInput", () => {
  it("accepts a phone booking without email and requires a contractor", () => {
    const result = validateAdminIntakeInput(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.emailProvided).toBe(false);
      expect(result.data.customerEmail).toBe("8165550199@phone.tradesondemand.invalid");
      expect(result.data.contractorId).toBe("shop_1");
      expect(result.data.skipDeposit).toBe(false);
    }
  });

  it("keeps a provided email and folds notes plus preferred time into the ticket", () => {
    const result = validateAdminIntakeInput({
      ...base,
      customerEmail: "Jordan@Home.example",
      notes: "Gate code 4411",
      preferredTime: "After 4pm today",
      skipDeposit: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.emailProvided).toBe(true);
      expect(result.data.customerEmail).toBe("jordan@home.example");
      expect(result.data.problem).toContain("Preferred time: After 4pm today");
      expect(result.data.problem).toContain("Dispatch notes: Gate code 4411");
      expect(result.data.skipDeposit).toBe(true);
    }
  });

  it("rejects a missing contractor", () => {
    const result = validateAdminIntakeInput({ ...base, contractorId: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("contractorId");
      expect(result.message).toMatch(/contractor/i);
    }
  });

  it("still requires a KC metro address", () => {
    const result = validateAdminIntakeInput({ ...base, city: "Denver", state: "CO", zip: "80202" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Kansas City metro/i);
  });
});

describe("phone placeholder email", () => {
  it("builds a stable lookup address from the 10-digit phone", () => {
    expect(phonePlaceholderEmail("(816) 555-0199")).toBe("8165550199@phone.tradesondemand.invalid");
    expect(isPhonePlaceholderEmail("8165550199@phone.tradesondemand.invalid")).toBe(true);
    expect(isPhonePlaceholderEmail("jordan@home.example")).toBe(false);
  });
});

describe("composeIntakeProblem", () => {
  it("joins optional dispatch fields without trailing blanks", () => {
    expect(composeIntakeProblem("Leak under sink", "", "")).toBe("Leak under sink");
    expect(composeIntakeProblem("Leak under sink", "Dog in yard", "Tonight")).toBe(
      "Leak under sink\n\nPreferred time: Tonight\n\nDispatch notes: Dog in yard",
    );
  });
});

describe("intakeDeposit", () => {
  it("forces a $0 skipped hold for phone jobs when asked", () => {
    const deposit = intakeDeposit({
      skipDeposit: true,
      urgency: "emergency",
      trade: "plumbing",
    });
    expect(deposit.amountCents).toBe(0);
    expect(deposit.skipped).toBe(true);
    expect(depositNoteForIntake(deposit)).toMatch(/skipped for phone dispatch/i);
  });

  it("records a pending emergency hold when deposit is not skipped", () => {
    const deposit = intakeDeposit({
      skipDeposit: false,
      urgency: "emergency",
      trade: "plumbing",
    });
    expect(deposit.amountCents).toBeGreaterThan(0);
    expect(deposit.skipped).toBe(false);
    expect(depositNoteForIntake(deposit)).toMatch(/pending TOD deposit hold/i);
  });
});

describe("pickMatchingIntakeCustomer", () => {
  const phoneHit: IntakeCustomer = {
    id: "c1",
    name: "Jordan Hale",
    email: "old@example.com",
    phone: "8165550199",
  };
  const emailHit: IntakeCustomer = {
    id: "c2",
    name: "Other",
    email: "jordan@home.example",
    phone: "8165550000",
  };

  it("prefers the phone match for a live call", () => {
    expect(pickMatchingIntakeCustomer(phoneHit, emailHit)?.id).toBe("c1");
    expect(pickMatchingIntakeCustomer(null, emailHit)?.id).toBe("c2");
    expect(pickMatchingIntakeCustomer(null, null)).toBeNull();
  });
});

describe("matchOrCreateIntakeCustomer", () => {
  function store(existing: IntakeCustomer | null): IntakeCustomerStore & {
    created: IntakeCustomer[];
    updated: { id: string; data: Record<string, string> }[];
  } {
    const created: IntakeCustomer[] = [];
    const updated: { id: string; data: Record<string, string> }[] = [];
    const rows = existing ? [existing] : [];
    return {
      created,
      updated,
      async findByPhone(phone) {
        return rows.find((row) => row.phone === phone) ?? null;
      },
      async findByEmail(email) {
        return rows.find((row) => row.email === email) ?? null;
      },
      async create(data) {
        const row = { id: "new", name: data.name, email: data.email, phone: data.phone };
        created.push(row);
        return row;
      },
      async update(id, data) {
        updated.push({ id, data: data as Record<string, string> });
        const current = rows[0] ?? { id, name: "", email: "", phone: "" };
        return { ...current, ...data, id };
      },
    };
  }

  it("creates a placeholder-email client when the phone is new", async () => {
    const db = store(null);
    const result = await matchOrCreateIntakeCustomer(
      {
        name: "Jordan Hale",
        phone: "8165550199",
        email: phonePlaceholderEmail("8165550199"),
        emailProvided: false,
        token: "tok",
      },
      db,
    );
    expect(result.created).toBe(true);
    expect(result.customer.email).toBe("8165550199@phone.tradesondemand.invalid");
    expect(db.created).toHaveLength(1);
  });

  it("updates the existing phone match instead of creating a duplicate", async () => {
    const db = store({
      id: "c1",
      name: "Old Name",
      email: "8165550199@phone.tradesondemand.invalid",
      phone: "8165550199",
    });
    const result = await matchOrCreateIntakeCustomer(
      {
        name: "Jordan Hale",
        phone: "8165550199",
        email: "jordan@home.example",
        emailProvided: true,
        token: "tok",
      },
      db,
    );
    expect(result.created).toBe(false);
    expect(result.customer.name).toBe("Jordan Hale");
    expect(db.updated[0]).toEqual({
      id: "c1",
      data: { name: "Jordan Hale", email: "jordan@home.example" },
    });
  });
});

describe("partitionIntakeContractors", () => {
  const shops = [
    shop({
      id: "a",
      businessName: "Waldo Heat & Pipe",
      trades: ["plumbing", "hvac"],
      serviceArea: "Kansas City, Brookside, Waldo, Independence",
    }),
    shop({
      id: "b",
      businessName: "Olathe Drain Co",
      trades: ["plumbing"],
      serviceArea: "Olathe and 66061",
    }),
    shop({
      id: "c",
      businessName: "Brookside Paint",
      trades: ["painting"],
      serviceArea: "Kansas City metro",
    }),
  ];

  it("keeps trade+area shops first and lists other coverage separately", () => {
    const { matching, otherCoverage, otherTrade } = partitionIntakeContractors(
      shops,
      "plumbing",
      "Kansas City",
      "64112",
    );
    expect(matching.map((row) => row.id)).toEqual(["a"]);
    expect(otherCoverage.map((row) => row.id)).toEqual(["b"]);
    expect(otherTrade.map((row) => row.id)).toEqual(["c"]);
  });
});

describe("filterContractorsByQuery", () => {
  const shops = [
    shop({
      id: "a",
      businessName: "Waldo Heat & Pipe",
      trades: ["hvac"],
      serviceArea: "Brookside",
    }),
    shop({
      id: "b",
      businessName: "Brookside Paint",
      trades: ["painting"],
      serviceArea: "Kansas City",
    }),
  ];

  it("filters by shop name, trade, or coverage text", () => {
    expect(filterContractorsByQuery(shops, "waldo").map((row) => row.id)).toEqual(["a"]);
    expect(filterContractorsByQuery(shops, "paint").map((row) => row.id)).toEqual(["b"]);
    expect(filterContractorsByQuery(shops, "brookside").map((row) => row.id).sort()).toEqual(["a", "b"]);
  });
});
