import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { requireAuthenticatedUser } from "@/lib/server/auth";

const actionSchema = z.enum(["dashboard_export_csv", "sync_attempt", "sync_result", "login", "logout"]);
const payloadSchema = z.record(z.unknown()).refine((v) => JSON.stringify(v).length <= 5000, "Payload too large");

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const body = await request.json().catch(() => null);
  const parsed = z.object({ action: actionSchema, payload: payloadSchema.optional() }).safeParse(body);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Invalid audit payload", requestId, parsed.error.flatten());

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Audit backend not configured", requestId);

  // BUG-014 fix: only validated action + bounded payload are persisted.
  const payload = {
    id: crypto.randomUUID(),
    actor_user_id: user.id,
    actor_role: user.role,
    action: parsed.data.action,
    payload: parsed.data.payload ?? {},
    created_at: new Date().toISOString()
  };

  const response = await fetch(`${url}/rest/v1/audit_logs`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to persist audit log", requestId, await response.text());
  return ok({ recorded: true }, requestId);
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);
  if (user.role !== "supervisor" && user.role !== "admin") return fail(403, "ROLE_REQUIRED", "Supervisor or admin role required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Audit backend not configured", requestId);

  const parsed = new URL(request.url);
  const page = Math.max(1, Number(parsed.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(10, Number(parsed.searchParams.get("limit") ?? "20")));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const endpoint = new URL(`${url}/rest/v1/audit_logs`);
  endpoint.searchParams.set("select", "id,actor_user_id,actor_role,action,target_type,target_id,payload,metadata,ip_address,user_agent,created_at");
  endpoint.searchParams.set("order", "created_at.desc");
  if (user.role === "supervisor") endpoint.searchParams.set("actor_user_id", `eq.${user.id}`);

  const response = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: `${from}-${to}` }
  });
  if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch audit logs", requestId, await response.text());

  const rows = await response.json();
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? rows.length);
  return ok({ page, limit, total, rows }, requestId);
}
