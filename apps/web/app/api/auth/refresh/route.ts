import { cookies } from "next/headers";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { setAuthCookies } from "@/lib/server/auth";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);
  // Refresh uses long-lived token from secure cookie, not request body.
  const refreshToken = (await cookies()).get("asibi_refresh_token")?.value;
  if (!refreshToken) return fail(400, "VALIDATION_ERROR", "Missing refresh token", requestId);

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return fail(500, "SERVER_NOT_CONFIGURED", "Auth not configured", requestId);

  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const payload = await response.json();
  if (!response.ok) return fail(401, "AUTH_FAILED", "Token refresh failed", requestId, payload);

  const res = ok({ expiresIn: payload.expires_in, user: payload.user }, requestId);
  setAuthCookies(res, payload.access_token, payload.refresh_token);
  return res;
}

