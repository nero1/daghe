import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getRedis } from "@/lib/server/redis";

const schema = z.object({
  facilityCode: z.string().length(8),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits"),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", "Invalid facilityCode or PIN", requestId, parsed.error.flatten());
  }

  const { facilityCode, pin } = parsed.data;

  // Rate limit per facilityCode (5 attempts/minute) to slow brute-force on shared PINs.
  const rate = await checkRateLimit(`pin:${facilityCode}`, 5, 60_000);
  if (!rate.ok) {
    return fail(429, "RATE_LIMITED", "Too many PIN attempts", requestId, { retryAfterSec: rate.retryAfterSec });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return fail(500, "SERVER_NOT_CONFIGURED", "Database not configured", requestId);
  }

  // Look up facility code — must be active and not expired.
  const endpoint = new URL(`${url}/rest/v1/facility_codes`);
  endpoint.searchParams.set("select", "id,facility_name,pin_hash,expires_at");
  endpoint.searchParams.set("code", `eq.${facilityCode}`);
  endpoint.searchParams.set("active", "eq.true");
  endpoint.searchParams.set("limit", "1");

  const facilityRes = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);

  if (!facilityRes || !facilityRes.ok) {
    return fail(500, "DB_ERROR", "Failed to look up facility", requestId);
  }

  const rows = (await facilityRes.json()) as Array<{
    id: string;
    facility_name: string;
    pin_hash: string;
    expires_at: string | null;
  }>;

  const facility = rows[0];
  if (!facility) {
    return fail(401, "INVALID_FACILITY", "Facility code not found or inactive", requestId);
  }

  // Check expiry.
  if (facility.expires_at && new Date(facility.expires_at) < new Date()) {
    return fail(401, "FACILITY_EXPIRED", "Facility code has expired", requestId);
  }

  // Hash the provided PIN with SHA-256 and compare using timing-safe equality.
  const providedHash = createHash("sha256").update(pin).digest("hex");
  const storedHash = facility.pin_hash;

  let pinValid = false;
  try {
    const a = Buffer.from(providedHash, "utf8");
    const b = Buffer.from(storedHash, "utf8");
    // timingSafeEqual requires equal-length buffers; both are hex strings so lengths match when hashes are the same algorithm.
    pinValid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    pinValid = false;
  }

  if (!pinValid) {
    return fail(401, "INVALID_PIN", "Incorrect PIN", requestId);
  }

  // Issue a session token stored in Redis for 5 minutes.
  const sessionToken = crypto.randomUUID();
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`pin_session:${facilityCode}:${sessionToken}`, facilityCode, { ex: 300 });
    } catch {
      // Non-fatal: token still returned; caller can retry on Redis unavailability.
    }
  }

  return ok(
    {
      sessionToken,
      facilityCode,
      facilityName: facility.facility_name,
    },
    requestId
  );
}
