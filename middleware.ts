import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const expected = await expectedToken();

  // No password configured anywhere → leave the door open rather than lock the
  // whole shop out over a missing env var. Once APP_PASSWORD is set, the gate is live.
  if (!expected) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token === expected) return NextResponse.next();

  // Already on the login page → let it render.
  if (req.nextUrl.pathname === "/login") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

// Run on every route EXCEPT the cron sweep (Vercel calls it without a cookie),
// Next internals, and static assets.
export const config = {
  matcher: ["/((?!api/cron|_next|favicon.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp|woff2?)).*)"],
};
