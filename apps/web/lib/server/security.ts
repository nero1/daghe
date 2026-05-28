import { cookies } from "next/headers";

/**
 * Issues a CSRF token cookie used by browser clients.
 * Edge case: token is intentionally readable by JS (httpOnly=false) so it can be echoed in `x-csrf-token`.
 */
export async function issueCsrfToken(response: { cookies: { set: Function } }) {
  // CSRF token is readable by client JS so it can be echoed in request headers.
  const token = crypto.randomUUID();
  response.cookies.set("asibi_csrf", token, { httpOnly: false, secure: true, sameSite: "lax", path: "/" });
  return token;
}

function isTrustedOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return true;
  try {
    // BUG-003 fix: parse the origin URL and compare exact host (no substring checks).
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

/**
 * Verifies CSRF using double-submit cookie + header matching and strict same-origin check.
 */
export async function verifyCsrf(request: Request): Promise<boolean> {
  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = (await cookies()).get("asibi_csrf")?.value;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const originAllowed = isTrustedOrigin(origin, host);
  return Boolean(originAllowed && headerToken && cookieToken && headerToken === cookieToken);
}
