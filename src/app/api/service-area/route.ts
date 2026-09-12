import { NextResponse } from "next/server";
import { evaluateServiceArea } from "@/lib/kc-metro";

export async function POST(request: Request) {
  let body: { zip?: string; city?: string; state?: string };
  try {
    body = (await request.json()) as { zip?: string; city?: string; state?: string };
  } catch {
    return NextResponse.json({ error: "JSON required." }, { status: 400 });
  }

  const result = evaluateServiceArea({
    zip: String(body.zip ?? ""),
    city: String(body.city ?? ""),
    state: String(body.state ?? ""),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
