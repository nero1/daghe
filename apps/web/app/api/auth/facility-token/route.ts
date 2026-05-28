import { createHash, createHmac } from "crypto";
import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getRedis } from "@/lib/server/redis";

const schema = z.object({
  code: z.string().length(8),
});

function base64urlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function buildFacilityJwt(
  facilityCode: string,
  facilityName: string,
  clinicId: string | null,
  secret: string
): { token: string; expiresAt: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + 3600;

  const header = base64urlEncode({ alg: "HS256", typ: "JWT" });
  const payload = base64urlEncode({
    facilityCode,
    facilityName,
    clinicId,
    exp,
    iat: nowSec,
  });

  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

  return { token: `${signingInput}.${signature}`, expiresAt: exp };
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  const rate = await checkRateLimit(`facility-token:${ip}`, 10, 60_000);
  if (!rate.ok) {
    return fail(429, "RATE_LIMITED", "Too many requests", requestId, { retryAfterSec: rate.retryAfterSec });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", "Invalid or missing facility code", requestId, parsed.error.flatten());
  }

  const { code } = parsed.data;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return fail(500, "SERVER_NOT_CONFIGURED", "Database not configured", requestId);
  }

  // Look up facility code — must be active and not expired.
  const endpoint = new URL(`${url}/rest/v1/facility_codes`);
  endpoint.searchParams.set("select", "id,facility_name,clinic_id,expires_at");
  endpoint.searchParams.set("code", `eq.${code}`);
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
    clinic_id: string | null;
    expires_at: string | null;
  }>;

  const facility = rows[0];
  if (!facility) {
    return fail(401, "INVALID_CODE", "Facility code not found or inactive", requestId);
  }

  if (facility.expires_at && new Date(facility.expires_at) < new Date()) {
    return fail(401, "FACILITY_EXPIRED", "Facility code has expired", requestId);
  }

  const jwtSecret =
    process.env.FACILITY_JWT_SECRET ?? process.env.BYOK_ENCRYPTION_KEY;
  if (!jwtSecret) {
    return fail(500, "SERVER_NOT_CONFIGURED", "JWT secret not configured", requestId);
  }

  const { token, expiresAt } = buildFacilityJwt(
    code,
    facility.facility_name,
    facility.clinic_id,
    jwtSecret
  );

  // Store a hash of the token in Redis (1-hour TTL) to allow revocation.
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`facility_token:${tokenHash}`, code, { ex: 3600 });
    } catch {
      // Non-fatal — token is still valid; Redis unavailability is a known degraded state.
    }
  }

  return ok(
    {
      token,
      facilityName: facility.facility_name,
      expiresAt,
    },
    requestId
  );
}
