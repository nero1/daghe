import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { isTokenRevoked, isSessionInvalidatedForUser } from "./redis";

export type AuthenticatedUser = { id: string; role: "chw" | "supervisor" | "admin" };
export type UserScope = { clinicId: string | null; regionId: string | null };

type CachedAuth = { user: AuthenticatedUser | null; expiresAt: number };
type CachedScope = { scope: UserScope; expiresAt: number };
const authCache = new Map<string, CachedAuth>();
const scopeCache = new Map<string, CachedScope>();
const AUTH_CACHE_TTL_MS = 15_000;

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  response.cookies.set("asibi_access_token", accessToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  response.cookies.set("asibi_refresh_token", refreshToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set("asibi_access_token", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set("asibi_refresh_token", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getBearerToken(authHeader: string | null): Promise<string | null> {
  if (authHeader?.startsWith("Bearer ")) return authHeader.replace("Bearer ", "");
  const cookieStore = await cookies();
  return cookieStore.get("asibi_access_token")?.value ?? null;
}

export async function requireAuthenticatedUser(
  authHeader: string | null,
  options?: { requireRole?: AuthenticatedUser["role"][] }
): Promise<AuthenticatedUser | null> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const token = await getBearerToken(authHeader);
  if (!url || !anon || !token) return null;

  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.user) return null;
    if (options?.requireRole && !options.requireRole.includes(cached.user.role)) return null;
    return cached.user;
  }
  if (await isTokenRevoked(token)) return null;

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; user_metadata?: { role?: string } };
    const role = user.user_metadata?.role;
    const normalizedRole: AuthenticatedUser["role"] = role === "supervisor" || role === "admin" ? role : "chw";
    const authUser = user.id ? { id: user.id, role: normalizedRole } : null;

    // Check session invalidation (role-change protection). Fail open if Redis unavailable.
    if (authUser) {
      try {
        // Parse JWT iat claim from the token body segment.
        const jwtPayload = JSON.parse(atob(token.split(".")[1]!)) as { iat?: number };
        const iat = jwtPayload.iat ?? 0;
        const invalidated = await isSessionInvalidatedForUser(authUser.id, iat);
        if (invalidated) {
          authCache.set(token, { user: null, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
          return null;
        }
      } catch {
        // Fail open — Redis or parse failure must not lock out users (PRD §14).
      }
    }

    authCache.set(token, { user: authUser, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    if (!authUser) return null;
    if (options?.requireRole && !options.requireRole.includes(authUser.role)) return null;
    return authUser;
  } catch {
    return null;
  }
}

export async function getUserScope(userId: string): Promise<UserScope> {
  const cached = scopeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.scope;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { clinicId: null, regionId: null };

  try {
    const endpoint = new URL(`${url}/rest/v1/users`);
    endpoint.searchParams.set("select", "clinic_id,region_id");
    endpoint.searchParams.set("id", `eq.${userId}`);
    endpoint.searchParams.set("limit", "1");
    const res = await fetch(endpoint.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { clinicId: null, regionId: null };
    const rows = (await res.json()) as Array<{ clinic_id: string | null; region_id: string | null }>;
    const scope: UserScope = { clinicId: rows[0]?.clinic_id ?? null, regionId: rows[0]?.region_id ?? null };
    // BUG-002 fix: cache supervisor scope for short TTL to enforce consistent scoped queries.
    scopeCache.set(userId, { scope, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return scope;
  } catch {
    return { clinicId: null, regionId: null };
  }
}
