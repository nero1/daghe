import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { invalidateUserSessions } from "@/lib/server/redis";

const patchSchema = z.object({
  role: z.enum(["chw", "supervisor", "admin"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  clinicId: z.string().nullable().optional(),
  regionId: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["admin"],
  });
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const { id: targetId } = await params;
  if (!targetId) return fail(400, "VALIDATION_ERROR", "User ID required", requestId);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Validation error", requestId, parsed.error.flatten());

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Backend not configured", requestId);

  // Fetch current user to detect role change.
  const currentEndpoint = new URL(`${url}/rest/v1/users`);
  currentEndpoint.searchParams.set("select", "id,role");
  currentEndpoint.searchParams.set("id", `eq.${targetId}`);
  currentEndpoint.searchParams.set("limit", "1");
  const currentRes = await fetch(currentEndpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!currentRes.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch user", requestId);
  const currentRows = (await currentRes.json()) as Array<{ id: string; role: string }>;
  if (currentRows.length === 0) return fail(404, "NOT_FOUND", "User not found", requestId);

  const previousRole = currentRows[0]!.role;
  const roleChanging = parsed.data.role !== undefined && parsed.data.role !== previousRole;

  // Build update payload from non-undefined fields.
  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) updatePayload.role = parsed.data.role;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
  if (parsed.data.clinicId !== undefined) updatePayload.clinic_id = parsed.data.clinicId;
  if (parsed.data.regionId !== undefined) updatePayload.region_id = parsed.data.regionId;

  if (Object.keys(updatePayload).length === 0) {
    return fail(400, "VALIDATION_ERROR", "No fields to update", requestId);
  }

  const updateEndpoint = new URL(`${url}/rest/v1/users`);
  updateEndpoint.searchParams.set("id", `eq.${targetId}`);

  const updateRes = await fetch(updateEndpoint.toString(), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updatePayload),
    signal: AbortSignal.timeout(5000),
  });
  if (!updateRes.ok) return fail(502, "UPSTREAM_ERROR", "Failed to update user", requestId);

  // If role changed, invalidate existing sessions so the user must re-auth.
  if (roleChanging) {
    await invalidateUserSessions(targetId);
  }

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
      action: "user_updated",
      target_type: "user",
      target_id: targetId,
      ip_address: ip,
      user_agent: userAgent,
      payload: { changes: updatePayload, roleChanged: roleChanging },
      created_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* non-fatal */ });

  return ok({ id: targetId, updated: true, sessionsInvalidated: roleChanging }, requestId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["admin"],
  });
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const { id: targetId } = await params;
  if (!targetId) return fail(400, "VALIDATION_ERROR", "User ID required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Backend not configured", requestId);

  // Soft-deactivate: update status in public.users.
  const deactivateEndpoint = new URL(`${url}/rest/v1/users`);
  deactivateEndpoint.searchParams.set("id", `eq.${targetId}`);

  const deactivateRes = await fetch(deactivateEndpoint.toString(), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status: "inactive" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!deactivateRes.ok) return fail(502, "UPSTREAM_ERROR", "Failed to deactivate user", requestId);

  // Ban the user in Supabase auth (effectively permanent — 100 years).
  const banRes = await fetch(`${url}/auth/v1/admin/users/${targetId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ ban_duration: "876000h" }),
    signal: AbortSignal.timeout(5000),
  });
  // Ban failure is non-fatal (soft-deactivation already applied) but log it.
  if (!banRes.ok) {
    // Proceed — the status=inactive will prevent most access.
  }

  // Invalidate Redis sessions.
  await invalidateUserSessions(targetId);

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
      action: "user_deactivated",
      target_type: "user",
      target_id: targetId,
      ip_address: ip,
      user_agent: userAgent,
      payload: {},
      created_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* non-fatal */ });

  return ok({ id: targetId, deactivated: true }, requestId);
}
