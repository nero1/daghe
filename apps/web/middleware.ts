import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiter for edge middleware (per-Vercel-instance).
// Redis is not available in edge runtime; this is a best-effort DoS guard.
const ipHits = new Map<string, { count: number; resetAt: number }>();
const BOT_UA_PATTERNS = ["python-requests", "go-http-client", "libwww-perl", "scrapy", "curl/"];
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, _next internals, and manifest
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/models/") ||
    pathname.startsWith("/demo/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const ua = request.headers.get("user-agent") ?? "";
  const isBot = !ua || BOT_UA_PATTERNS.some(p => ua.toLowerCase().includes(p));
  if (isBot) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const entry = ipHits.get(ip);

  if (!entry || entry.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else if (entry.count >= RATE_LIMIT) {
    return new NextResponse("Rate limited", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  } else {
    entry.count += 1;
  }

  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("X-Request-ID", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
