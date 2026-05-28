import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { requireAuthenticatedUser } from "@/lib/server/auth";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  region_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["admin"],
  });
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Backend not configured", requestId);

  const endpoint = new URL(`${url}/rest/v1/clinics`);
  endpoint.searchParams.set("select", "id,name,region_id,created_at");
  endpoint.searchParams.set("order", "name.asc");

  const res = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch clinics", requestId);

  const clinics = await res.json();
  return ok({ clinics }, requestId);
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["admin"],
  });
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Validation error", requestId, parsed.error.flatten());

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Backend not configured", requestId);

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  const createRes = await fetch(`${url}/rest/v1/clinics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: newId,
      name: parsed.data.name,
      region_id: parsed.data.region_id ?? null,
      metadata: parsed.data.metadata ?? {},
      created_at: now,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!createRes.ok) return fail(502, "UPSTREAM_ERROR", "Failed to create clinic", requestId);

  const rows = (await createRes.json()) as unknown[];
  const clinic = Array.isArray(rows) ? rows[0] : rows;

  // Audit log.
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  await fetch(`${url}/rest/v1/audit_logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      actor_role: user.role,
      action: "clinic_created",
      target_type: "clinic",
      target_id: newId,
      ip_address: ip,
      user_agent: userAgent,
      payload: { name: parsed.data.name },
      created_at: now,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* non-fatal */ });

  return new Response(JSON.stringify({ requestId, data: { clinic } }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
