import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_TTL_MS,
  signAdminToken,
  timingSafeEqualStr,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminPassword || !adminSecret) {
    return NextResponse.json(
      { error: "Admin not configured" },
      { status: 500 },
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!password || !timingSafeEqualStr(password, adminPassword)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const expMs = Date.now() + SESSION_TTL_MS;
  const token = await signAdminToken(expMs, adminSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
