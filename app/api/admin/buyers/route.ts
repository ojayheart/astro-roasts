import { NextResponse } from "next/server";
import { listBuyers } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json({ buyers: await listBuyers() });
}
