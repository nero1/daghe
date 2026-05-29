import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/server/rate-limit";

// GET /api/auth/google — initiate Google OAuth via Supabase
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = await checkRateLimit(`oauth_init:${ip}`, 20, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const appUrl = process.env.APP_URL ?? (
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  );
  const redirectTo = `${appUrl}/api/auth/callback`;

  const oauthUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
  oauthUrl.searchParams.set("provider", "google");
  oauthUrl.searchParams.set("redirect_to", redirectTo);

  return NextResponse.redirect(oauthUrl.toString());
}
