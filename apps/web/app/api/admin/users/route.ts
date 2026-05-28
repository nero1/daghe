import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { requireAuthenticatedUser } from "@/lib/server/auth";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["chw", "supervisor", "admin"]),
  clinicId: z.string().optional(),
  regionId: z.string().optional(),
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

  const params = new URL(request.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? "20")));
  const cursor = Math.max(0, Number(params.get("cursor") ?? "0"));
  const roleFilter = params.get("role");

  const endpoint = new URL(`${url}/rest/v1/users`);
  endpoint.searchParams.set("select", "id,email,name,role,status,clinic_id,region_id,created_at");
  endpoint.searchParams.set("order", "created_at.desc");
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("offset", String(cursor));
  if (roleFilter && ["chw", "supervisor", "admin"].includes(roleFilter)) {
    endpoint.searchParams.set("role", `eq.${roleFilter}`);
  }

  const res = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch users", requestId);

  const rows = await res.json();
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
  const nextCursor = cursor + limit < total ? cursor + limit : null;

  return ok({ users: rows, total, cursor, nextCursor }, requestId);
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

  const { email, password, name, role, clinicId, regionId } = parsed.data;

  // Create auth user via Supabase admin API.
  const authRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name },
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!authRes.ok) {
    const errText = await authRes.text();
    const isDuplicate = errText.includes("already") || authRes.status === 422;
    if (isDuplicate) return fail(409, "EMAIL_IN_USE", "Email already registered", requestId);
    return fail(502, "UPSTREAM_ERROR", "Failed to create auth user", requestId);
  }

  const authUser = (await authRes.json()) as { id: string };
  const newUserId = authUser.id;

  // Insert public profile row.
  const profileRes = await fetch(`${url}/rest/v1/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: newUserId,
      email,
      role,
      name,
      status: "active",
      clinic_id: clinicId ?? null,
      region_id: regionId ?? null,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!profileRes.ok) return fail(502, "UPSTREAM_ERROR", "Failed to create user profile", requestId);

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
      action: "user_created",
      target_type: "user",
      target_id: newUserId,
      ip_address: ip,
      user_agent: userAgent,
      payload: { email, name, role },
      created_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* non-fatal */ });

  return new Response(JSON.stringify({ requestId, data: { id: newUserId } }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
