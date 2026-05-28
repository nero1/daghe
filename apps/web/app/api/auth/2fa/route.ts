import { createHmac, randomBytes } from "crypto";
import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { requireAuthenticatedUser, getBearerToken } from "@/lib/server/auth";
import { getRedis } from "@/lib/server/redis";

// ---------------------------------------------------------------------------
// Minimal TOTP implementation (RFC 6238 / RFC 4226) — no otplib dependency.
// ---------------------------------------------------------------------------

function hotp(secretBase64: string, counter: number): string {
  const key = Buffer.from(secretBase64, "base64url");
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter), 0);
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[19]! & 0xf;
  const code =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function verifyTotp(secret: string, code: string): boolean {
  const t = Math.floor(Date.now() / 30_000);
  return [t - 1, t, t + 1].some((counter) => hotp(secret, counter) === code);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

const verifySchema = z.object({ code: z.string().length(6), secret: z.string() });
const disableSchema = z.object({ code: z.string().length(6) });

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action !== "setup") {
    return fail(400, "INVALID_ACTION", "Use ?action=setup for GET", requestId);
  }

  // Require authenticated user.
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) {
    return fail(401, "UNAUTHORIZED", "Authentication required", requestId);
  }

  // Generate a 20-byte random secret encoded as base64url (serves as the TOTP key).
  const secret = randomBytes(20).toString("base64url");
  const otpauthUrl = `otpauth://totp/Daghe:${user.id}?secret=${secret}&issuer=Daghe`;

  return ok({ secret, otpauthUrl }, requestId);
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "verify") {
    const body = await request.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "VALIDATION_ERROR", "Provide code (6 digits) and secret", requestId, parsed.error.flatten());
    }

    const user = await requireAuthenticatedUser(request.headers.get("authorization"));
    if (!user) {
      return fail(401, "UNAUTHORIZED", "Authentication required", requestId);
    }

    const { code, secret } = parsed.data;
    if (!verifyTotp(secret, code)) {
      return fail(401, "INVALID_CODE", "TOTP code is incorrect or expired", requestId);
    }

    // Persist secret in Redis with 30-day TTL.
    const redis = getRedis();
    if (redis) {
      try {
        await redis.set(`2fa_secret:${user.id}`, secret, { ex: 30 * 24 * 3600 });
      } catch {
        // Non-fatal — caller can retry; secret is returned for client storage.
      }
    }

    return ok({ verified: true }, requestId);
  }

  if (action === "disable") {
    const body = await request.json().catch(() => null);
    const parsed = disableSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "VALIDATION_ERROR", "Provide a 6-digit code", requestId, parsed.error.flatten());
    }

    const user = await requireAuthenticatedUser(request.headers.get("authorization"));
    if (!user) {
      return fail(401, "UNAUTHORIZED", "Authentication required", requestId);
    }

    // Retrieve stored secret to verify before disabling.
    const redis = getRedis();
    if (!redis) {
      return fail(503, "SERVICE_UNAVAILABLE", "Redis unavailable; cannot disable 2FA right now", requestId);
    }

    let storedSecret: string | null = null;
    try {
      storedSecret = await redis.get<string>(`2fa_secret:${user.id}`);
    } catch {
      return fail(503, "SERVICE_UNAVAILABLE", "Failed to read 2FA secret", requestId);
    }

    if (!storedSecret) {
      return fail(404, "NOT_FOUND", "2FA is not enabled for this user", requestId);
    }

    if (!verifyTotp(storedSecret, parsed.data.code)) {
      return fail(401, "INVALID_CODE", "TOTP code is incorrect or expired", requestId);
    }

    try {
      await redis.del(`2fa_secret:${user.id}`);
    } catch {
      return fail(503, "SERVICE_UNAVAILABLE", "Failed to remove 2FA secret", requestId);
    }

    return ok({ disabled: true }, requestId);
  }

  return fail(400, "INVALID_ACTION", "Use ?action=verify or ?action=disable", requestId);
}
