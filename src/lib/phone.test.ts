import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPATCH_PHONE,
  formatPhone,
  isValidEmail,
  isValidUsPhone,
  telHref,
} from "./phone";

describe("phone helpers", () => {
  it("formats the KC business line", () => {
    expect(formatPhone(DEFAULT_DISPATCH_PHONE)).toBe("(816) 516-0735");
  });

  it("builds a tel link for the business line", () => {
    expect(telHref(DEFAULT_DISPATCH_PHONE)).toBe("tel:+18165160735");
  });

  it("validates US phones and emails", () => {
    expect(isValidUsPhone("(816) 555-0199")).toBe(true);
    expect(isValidUsPhone("555")).toBe(false);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
  });
});
