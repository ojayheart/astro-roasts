import { NextResponse } from "next/server";
import { fetchRevenueSummary } from "@/lib/admin-stripe";

export async function GET() {
  try {
    const summary = await fetchRevenueSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
