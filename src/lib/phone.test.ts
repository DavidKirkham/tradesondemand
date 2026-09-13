import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPATCH_PHONE,
  formatPhone,
  getDispatchPhone,
  isValidEmail,
  isValidUsPhone,
  telHref,
  isReservedUsFictionPhone,
  toE164Us,
} from "./phone";

describe("phone helpers", () => {
  it("formats the KC business line", () => {
    expect(formatPhone(DEFAULT_DISPATCH_PHONE)).toBe("(816) 516-0735");
  });

  it("builds a tel link for the business line", () => {
    expect(telHref(DEFAULT_DISPATCH_PHONE)).toBe("tel:+18165160735");
  });

  it("falls back to the KC business line when env is empty", () => {
    const previousDispatch = process.env.NEXT_PUBLIC_DISPATCH_PHONE;
    const previousPhone = process.env.NEXT_PUBLIC_PHONE;
    try {
      process.env.NEXT_PUBLIC_DISPATCH_PHONE = "";
      process.env.NEXT_PUBLIC_PHONE = "";
      expect(getDispatchPhone()).toBe("8165160735");
      expect(telHref()).toBe("tel:+18165160735");
    } finally {
      process.env.NEXT_PUBLIC_DISPATCH_PHONE = previousDispatch;
      process.env.NEXT_PUBLIC_PHONE = previousPhone;
    }
  });

  it("reads NEXT_PUBLIC_PHONE when the dispatch var is empty", () => {
    const previousDispatch = process.env.NEXT_PUBLIC_DISPATCH_PHONE;
    const previousPhone = process.env.NEXT_PUBLIC_PHONE;
    try {
      process.env.NEXT_PUBLIC_DISPATCH_PHONE = "";
      process.env.NEXT_PUBLIC_PHONE = "8165160735";
      expect(getDispatchPhone()).toBe("8165160735");
      expect(formatPhone(getDispatchPhone())).toBe("(816) 516-0735");
    } finally {
      process.env.NEXT_PUBLIC_DISPATCH_PHONE = previousDispatch;
      process.env.NEXT_PUBLIC_PHONE = previousPhone;
    }
  });

  it("validates US phones and emails", () => {
    expect(isValidUsPhone("(816) 555-0199")).toBe(true);
    expect(isValidUsPhone("555")).toBe(false);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(toE164Us("8165550199")).toBe("+18165550199");
    expect(isReservedUsFictionPhone("8165550199")).toBe(true);
    expect(isReservedUsFictionPhone("8165160735")).toBe(false);
  });
});
