import { cookies } from "next/headers";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { clearAuthCookies } from "@/lib/server/auth";
import { revokeToken } from "@/lib/server/redis";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return fail(500, "SERVER_NOT_CONFIGURED", "Auth not configured", requestId);

  const token = (await cookies()).get("asibi_access_token")?.value;
  if (token) {
    // Revoke in Redis so the JWT cannot be replayed before its natural expiry.
    await revokeToken(token);
    await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  }

  const res = ok({ ok: true }, requestId);
  clearAuthCookies(res);
  return res;
}
