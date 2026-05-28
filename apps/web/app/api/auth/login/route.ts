import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { setAuthCookies } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  // Throttle brute-force attempts per source IP.
  const rate = await checkRateLimit(`login:${ip}`, 8, 60_000);
  if (!rate.ok) return fail(429, "RATE_LIMITED", "Too many requests", requestId, { retryAfterSec: rate.retryAfterSec });
  const body = await request.json().catch(() => null);
  // Parse defensively so malformed JSON produces a clean 400 response.
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Validation error", requestId, parsed.error.flatten());

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return fail(500, "SERVER_NOT_CONFIGURED", "Auth not configured", requestId);

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon },
    body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password })
  });
  const payload = await response.json();
  if (!response.ok) return fail(401, "AUTH_FAILED", "Authentication failed", requestId, payload);

  const res = ok({ expiresIn: payload.expires_in, user: payload.user }, requestId);
  setAuthCookies(res, payload.access_token, payload.refresh_token);
  return res;
}

