import { NextRequest, NextResponse } from "next/server";
import { listRoasts, getRoastDetail, type RoastFilter } from "@/lib/admin-data";

const FILTERS: RoastFilter[] = ["all", "unsent", "errors", "unpaid"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const detail = await getRoastDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  }
  const raw = searchParams.get("filter") ?? "all";
  const filter: RoastFilter = FILTERS.includes(raw as RoastFilter)
    ? (raw as RoastFilter)
    : "all";
  return NextResponse.json({ filter, roasts: await listRoasts(filter) });
}
