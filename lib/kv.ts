import { kv } from "@vercel/kv";
import type { RoastData } from "./types";

const ROAST_TTL = 60 * 60 * 24 * 30; // 30 days

export async function getRoast(id: string): Promise<RoastData | null> {
  return kv.get<RoastData>(`roast:${id}`);
}

export async function setRoast(id: string, data: RoastData): Promise<void> {
  await kv.set(`roast:${id}`, data, { ex: ROAST_TTL });
}

export async function markPaid(id: string): Promise<void> {
  const roast = await getRoast(id);
  if (roast) {
    await setRoast(id, { ...roast, paid: true });
  }
}
