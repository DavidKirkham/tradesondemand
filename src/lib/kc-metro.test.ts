import { describe, expect, it } from "vitest";
import { evaluateServiceArea, isMetroCity, isMetroZip } from "./kc-metro";

describe("KC metro gate", () => {
  it("accepts core Missouri and Kansas ZIPs", () => {
    expect(isMetroZip("64111")).toBe(true);
    expect(isMetroZip("64108")).toBe(true);
    expect(isMetroZip("66210")).toBe(true);
    expect(isMetroZip("66062")).toBe(true);
    expect(isMetroZip("64050")).toBe(true);
    expect(isMetroZip("64081")).toBe(true);
    expect(isMetroZip("66101")).toBe(true);
    expect(isMetroZip("66216")).toBe(true);
  });

  it("rejects obvious non-metro ZIPs", () => {
    expect(isMetroZip("60601")).toBe(false);
    expect(isMetroZip("10001")).toBe(false);
    expect(isMetroZip("80202")).toBe(false);
    expect(isMetroZip("6411")).toBe(false);
  });

  it("recognizes metro cities and aliases", () => {
    expect(isMetroCity("Kansas City")).toBe(true);
    expect(isMetroCity("Overland Park")).toBe(true);
    expect(isMetroCity("Lee's Summit")).toBe(true);
    expect(isMetroCity("Lees Summit")).toBe(true);
    expect(isMetroCity("KCMO")).toBe(true);
    expect(isMetroCity("Shawnee")).toBe(true);
    expect(isMetroCity("Chicago")).toBe(false);
    expect(isMetroCity("Wichita")).toBe(false);
  });

  it("accepts a complete KC address", () => {
    const result = evaluateServiceArea({
      zip: "64111",
      city: "Kansas City",
      state: "MO",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zip).toBe("64111");
      expect(result.state).toBe("MO");
    }
  });

  it("rejects a KC city with a coastal ZIP", () => {
    const result = evaluateServiceArea({
      zip: "90210",
      city: "Overland Park",
      state: "KS",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("out_of_area");
      expect(result.message).toMatch(/Kansas City metro/i);
    }
  });

  it("rejects a valid-looking ZIP in another city", () => {
    const result = evaluateServiceArea({
      zip: "64111",
      city: "Chicago",
      state: "IL",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-metro states with the KC-only message", () => {
    const result = evaluateServiceArea({
      zip: "80202",
      city: "Denver",
      state: "CO",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("out_of_area");
      expect(result.message).toMatch(/Kansas City metro/i);
    }
  });
});
