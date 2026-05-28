import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { checkRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  clinicCode: z.string().optional(),
  chwId: z.string().optional(),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  // Strictly rate-limit registrations to prevent account-farming.
  const rate = await checkRateLimit(`register:${ip}`, 5, 60_000);
  if (!rate.ok) return fail(429, "RATE_LIMITED", "Too many requests", requestId, { retryAfterSec: rate.retryAfterSec });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Validation error", requestId, parsed.error.flatten());

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return fail(500, "SERVER_NOT_CONFIGURED", "Registration backend not configured", requestId);

  const { email, password, name, chwId } = parsed.data;

  // Create the Supabase auth user via the admin API.
  const authRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "chw", name, chwId: chwId ?? null },
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!authRes.ok) {
    const errText = await authRes.text();
    const isDuplicate = errText.includes("already") || authRes.status === 422;
    if (isDuplicate) return fail(409, "EMAIL_IN_USE", "Email already registered", requestId);
    return fail(502, "UPSTREAM_ERROR", "Failed to create account", requestId);
  }

  const authUser = (await authRes.json()) as { id: string };
  const userId = authUser.id;

  // Insert the public profile row using the service role.
  const profileRes = await fetch(`${url}/rest/v1/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ id: userId, email, role: "chw", name, status: "active" }),
    signal: AbortSignal.timeout(5000),
  });

  if (!profileRes.ok) {
    // Auth user was created but profile insert failed — log for manual remediation.
    // Do not expose the half-created state to the caller.
    return fail(502, "UPSTREAM_ERROR", "Failed to create user profile", requestId);
  }

  // Audit log the registration.
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  await fetch(`${url}/rest/v1/audit_logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      actor_user_id: userId,
      actor_role: "chw",
      action: "user_registered",
      target_type: "user",
      target_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      payload: { email, name },
      created_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* Audit failure must not block registration response */ });

  return new Response(JSON.stringify({ requestId, data: { id: userId } }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
