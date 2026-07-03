import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login/logout must be reachable without a session.
  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SECRET?.trim() ?? "";
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const valid = secret
    ? await verifyAdminToken(token, secret, Date.now())
    : false;

  if (valid) return NextResponse.next();

  // API routes: hard 401. Pages: let the request through so the page can
  // render its own login form (avoids a redirect loop + keeps it one URL).
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}
