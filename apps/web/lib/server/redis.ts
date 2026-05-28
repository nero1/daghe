import { Redis } from "@upstash/redis";

// Redis client is initialized lazily and only when env vars are present.
// All callers must handle null gracefully — Redis is unavailable in local dev
// and optional in production (PRD §14: graceful degradation on Redis failure).
let _client: Redis | null = null;

export function getRedis(): Redis | null {
  if (_client) return _client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _client = new Redis({ url, token });
  return _client;
}

// Revoke an access token for `ttlSeconds` so auth middleware can reject it.
// Used on logout so JWTs cannot be replayed after session is cleared.
export async function revokeToken(accessToken: string, ttlSeconds = 7200): Promise<void> {
  const redis = getRedis();
  if (!redis) return; // Degrade gracefully — Supabase logout still runs
  // Use last 128 chars of the token as key to avoid oversized keys.
  const key = `revoked:${accessToken.slice(-128)}`;
  try {
    await redis.set(key, "1", { ex: ttlSeconds });
  } catch {
    // Redis failure must not block the logout response (PRD §14).
  }
}

// Returns true if the token has been explicitly revoked (post-logout).
export async function isTokenRevoked(accessToken: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false; // Cannot check — allow through; Supabase validates independently
  const key = `revoked:${accessToken.slice(-128)}`;
  try {
    return (await redis.exists(key)) === 1;
  } catch {
    return false; // Redis failure: fail open rather than locking out all users
  }
}

// Redis-backed rate limit check. Returns { ok, retryAfterSec }.
// Falls back to always-ok when Redis is unavailable so the in-memory limiter takes over.
export async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec: number; source: "redis" | "fallback" }> {
  const redis = getRedis();
  if (!redis) return { ok: true, retryAfterSec: 0, source: "fallback" };

  const windowSec = Math.ceil(windowMs / 1000);
  const bucket = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${key}:${bucket}`;

  try {
    // BUG-006 fix: window-bucketed key avoids INCR/EXPIRE split races on a single rolling key.
    // Each bucket key is independent and receives a TTL; stale keys naturally expire.
    const [count] = await redis.pipeline().incr(redisKey).expire(redisKey, windowSec + 1).exec<number[]>();
    if (count > limit) {
      const ttl = await redis.ttl(redisKey);
      return { ok: false, retryAfterSec: ttl > 0 ? ttl : windowSec, source: "redis" };
    }
    return { ok: true, retryAfterSec: windowSec, source: "redis" };
  } catch {
    return { ok: true, retryAfterSec: 0, source: "fallback" };
  }
}

// Cache a dashboard summary with a short TTL to reduce repeated Supabase queries.
export async function cacheDashboardSummary(
  key: string,
  value: unknown,
  ttlSeconds = 60
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`dash:${key}`, JSON.stringify(value), { ex: ttlSeconds });
  } catch { /* non-fatal */ }
}

export async function getCachedDashboardSummary<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(`dash:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Thundering herd protection: acquire a short-lived lock before computing expensive data.
// Returns true if lock acquired, false if another instance is already computing.
export async function acquireComputeLock(key: string, ttlSeconds = 10): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // Degrade gracefully — proceed without lock
  const lockKey = `lock:${key}`;
  try {
    // NX ensures only one caller gets the lock; EX auto-expires the key.
    const result = await redis.set(lockKey, "1", { nx: true, ex: ttlSeconds });
    return result === "OK";
  } catch {
    return true; // Redis failure: allow through so callers are not blocked
  }
}

// Release a compute lock.
export async function releaseComputeLock(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`lock:${key}`);
  } catch { /* non-fatal */ }
}

// Store an idempotency key in Redis for sync deduplication.
// Returns true if key is new (safe to process), false if already seen (duplicate).
export async function checkAndStoreIdempotencyKey(idempotencyKey: string, ttlSeconds = 86400): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // Cannot check — allow through; DB unique constraint is the safety net
  const redisKey = `idem:${idempotencyKey}`;
  try {
    const result = await redis.set(redisKey, "1", { nx: true, ex: ttlSeconds });
    return result === "OK"; // OK = newly set (safe to process); null = already existed (duplicate)
  } catch {
    return true; // Redis failure: allow through; DB will handle true duplicates
  }
}

// Triage rules cache — dedicated namespace separate from dashboard cache.
export async function cacheTriageRules(version: string, rules: unknown, ttlSeconds = 3600): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`triage:rules:${version}`, JSON.stringify(rules), { ex: ttlSeconds });
  } catch { /* non-fatal */ }
}

export async function getCachedTriageRules(version: string): Promise<unknown | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(`triage:rules:${version}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Role-keyed session invalidation: store a "must re-auth after" timestamp for a user.
// When a user's role changes, call this so their in-flight JWTs are rejected.
export async function invalidateUserSessions(userId: string, ttlSeconds = 7200): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`session:invalidated:${userId}`, Date.now().toString(), { ex: ttlSeconds });
  } catch { /* non-fatal */ }
}

// Returns true if the JWT (identified by its iat claim) was issued before the invalidation timestamp.
export async function isSessionInvalidatedForUser(userId: string, issuedAt: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false; // Cannot check — fail open (PRD §14: graceful degradation)
  try {
    const raw = await redis.get<string>(`session:invalidated:${userId}`);
    if (!raw) return false;
    const invalidatedAtMs = Number(raw);
    // JWT iat is in seconds; convert to ms for comparison.
    return issuedAt * 1000 < invalidatedAtMs;
  } catch {
    return false; // Redis failure: fail open rather than locking out valid users
  }
}
