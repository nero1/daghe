import { createHash, createHmac } from "crypto";
import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { checkRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  const rate = await checkRateLimit(`telegram:${ip}`, 10, 60_000);
  if (!rate.ok) {
    return fail(429, "RATE_LIMITED", "Too many requests", requestId, { retryAfterSec: rate.retryAfterSec });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", "Missing or invalid fields", requestId, parsed.error.flatten());
  }

  const { hash, ...fields } = parsed.data;

  // Reject stale auth_date (older than 86400 seconds).
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - fields.auth_date > 86400) {
    return fail(401, "AUTH_EXPIRED", "Telegram auth_date is too old", requestId);
  }

  // Build check string: all fields sorted alphabetically as key=value joined with \n.
  const checkString = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // Secret key = SHA256 of the bot token (raw bytes, not hex string).
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return fail(500, "SERVER_NOT_CONFIGURED", "Telegram not configured", requestId);
  }
  const secretKey = createHash("sha256").update(botToken).digest();

  // Verify HMAC-SHA256.
  const expectedHash = createHmac("sha256", secretKey).update(checkString).digest("hex");
  if (expectedHash !== hash) {
    return fail(401, "INVALID_HASH", "Telegram hash verification failed", requestId);
  }

  // Upsert user into Supabase `users` table with role='chw'.
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return fail(500, "SERVER_NOT_CONFIGURED", "Database not configured", requestId);
  }

  const telegramId = String(fields.id);

  // Use a synthetic email for Telegram users (email NOT NULL constraint in users table)
  const syntheticEmail = `telegram_${telegramId}@daghe.internal`;

  const upsertRes = await fetch(`${url}/rest/v1/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      telegram_id: telegramId,
      email: syntheticEmail,
      name: [fields.first_name, fields.last_name].filter(Boolean).join(" "),
      first_name: fields.first_name,
      last_name: fields.last_name ?? null,
      photo_url: fields.photo_url ?? null,
      role: "chw",
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!upsertRes || !upsertRes.ok) {
    return fail(500, "DB_ERROR", "Failed to upsert user", requestId);
  }

  const rows = (await upsertRes.json()) as Array<{ id: string }>;
  const userId = rows[0]?.id ?? null;

  return ok({ userId, telegramId }, requestId);
}
