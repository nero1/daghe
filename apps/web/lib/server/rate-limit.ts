import { redisRateLimit } from "./redis";

// In-memory fallback for single-instance or local dev contexts.
// On Vercel serverless, this resets on cold start — Redis is the durable layer.
const bucket = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = bucket.get(key);
  if (!existing || existing.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  bucket.set(key, existing);
  return { ok: true, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
}

// Checks rate limit using Redis when available, falling back to in-memory.
// This function is async because Redis is I/O-bound; callers must await it.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const redisResult = await redisRateLimit(key, limit, windowMs);
  // BUG-007 fix: treat Redis as source-of-truth when available; only fallback to memory on explicit fallback path.
  if (redisResult.source === "redis") return { ok: redisResult.ok, retryAfterSec: redisResult.retryAfterSec };
  return inMemoryRateLimit(key, limit, windowMs);
}
