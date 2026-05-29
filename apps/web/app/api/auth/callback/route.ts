import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/server/auth";

// GET /api/auth/callback — handles OAuth redirect from Supabase (Google, etc.)
// Supabase passes the session in the URL fragment, but for server-side handling
// we exchange the code for a session using the PKCE flow.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const appUrl = process.env.APP_URL ?? (
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  );

  if (error) {
    const dest = new URL("/register", appUrl);
    dest.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(dest.toString());
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/register?error=No+auth+code+received`);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anon) {
    return NextResponse.redirect(`${appUrl}/register?error=Auth+not+configured`);
  }

  // Exchange the auth code for a session.
  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon },
    body: JSON.stringify({ auth_code: code }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!tokenRes || !tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/register?error=OAuth+exchange+failed`);
  }

  const payload = await tokenRes.json() as { access_token?: string; refresh_token?: string };
  if (!payload.access_token || !payload.refresh_token) {
    return NextResponse.redirect(`${appUrl}/register?error=Invalid+OAuth+response`);
  }

  const response = NextResponse.redirect(`${appUrl}/`);
  setAuthCookies(response as Parameters<typeof setAuthCookies>[0], payload.access_token, payload.refresh_token);
  return response;
}
