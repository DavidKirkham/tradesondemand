import { describe, expect, it } from "vitest";
import { formatPhone, isValidEmail, isValidUsPhone, telHref } from "./phone";

describe("phone helpers", () => {
  it("formats a 10-digit KC number", () => {
    expect(formatPhone("8165550136")).toBe("(816) 555-0136");
  });

  it("builds a tel link", () => {
    expect(telHref("8165550136")).toBe("tel:+18165550136");
  });

  it("validates US phones and emails", () => {
    expect(isValidUsPhone("(816) 555-0199")).toBe(true);
    expect(isValidUsPhone("555")).toBe(false);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
  });
});
