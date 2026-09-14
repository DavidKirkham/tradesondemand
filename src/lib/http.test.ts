import { describe, expect, it } from "vitest";
import { parseResponseJson } from "./http";

describe("parseResponseJson", () => {
  it("returns {} for an empty 500 so the UI can show a server error", async () => {
    const payload = await parseResponseJson(new Response("", { status: 500 }));
    expect(payload).toEqual({});
  });

  it("reads a JSON error body", async () => {
    const payload = await parseResponseJson<{ error?: string }>(
      new Response(JSON.stringify({ error: "schema behind" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(payload.error).toBe("schema behind");
  });

  it("returns {} for HTML / non-JSON", async () => {
    const payload = await parseResponseJson(new Response("<html>oops</html>", { status: 500 }));
    expect(payload).toEqual({});
  });
});
