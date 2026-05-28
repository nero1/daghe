import { z } from "zod";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { requireAuthenticatedUser, getUserScope } from "@/lib/server/auth";

const schema = z.object({
  flagged: z.boolean(),
  reason: z.string().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["supervisor", "admin"],
  });
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const { id: caseId } = await params;
  if (!caseId) return fail(400, "VALIDATION_ERROR", "Case ID required", requestId);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Validation error", requestId, parsed.error.flatten());

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Backend not configured", requestId);

  // Fetch user scope to enforce clinic/region boundaries.
  const scope = await getUserScope(user.id);

  // Verify the case exists and is within the caller's scope.
  const caseEndpoint = new URL(`${url}/rest/v1/cases`);
  caseEndpoint.searchParams.set("select", "id,clinic_id,region_id");
  caseEndpoint.searchParams.set("id", `eq.${caseId}`);
  caseEndpoint.searchParams.set("limit", "1");

  const caseRes = await fetch(caseEndpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!caseRes.ok) return fail(502, "UPSTREAM_ERROR", "Failed to verify case", requestId);

  const cases = (await caseRes.json()) as Array<{ id: string; clinic_id: string | null; region_id: string | null }>;
  if (cases.length === 0) return fail(404, "NOT_FOUND", "Case not found", requestId);

  const targetCase = cases[0]!;

  // Scope enforcement: admin bypasses scope; supervisor must match clinic or region.
  if (user.role === "supervisor" && scope.clinicId !== null && scope.regionId !== null) {
    const inScope =
      (scope.clinicId && targetCase.clinic_id === scope.clinicId) ||
      (scope.regionId && targetCase.region_id === scope.regionId);
    if (!inScope) return fail(403, "SCOPE_DENIED", "Case is outside your scope", requestId);
  } else if (user.role === "supervisor" && scope.clinicId !== null) {
    if (targetCase.clinic_id !== scope.clinicId) return fail(403, "SCOPE_DENIED", "Case is outside your scope", requestId);
  } else if (user.role === "supervisor" && scope.regionId !== null) {
    if (targetCase.region_id !== scope.regionId) return fail(403, "SCOPE_DENIED", "Case is outside your scope", requestId);
  }

  // Update flag state on the case.
  const { flagged, reason } = parsed.data;
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    is_flagged: flagged,
    flag_reason: flagged ? (reason ?? null) : null,
    flagged_by: flagged ? user.id : null,
    flagged_at: flagged ? now : null,
  };

  const updateEndpoint = new URL(`${url}/rest/v1/cases`);
  updateEndpoint.searchParams.set("id", `eq.${caseId}`);

  const updateRes = await fetch(updateEndpoint.toString(), {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updatePayload),
    signal: AbortSignal.timeout(5000),
  });
  if (!updateRes.ok) return fail(502, "UPSTREAM_ERROR", "Failed to update case", requestId);

  // Audit log the action.
  const action = flagged ? "case_flagged" : "case_unflagged";
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
      action,
      target_type: "case",
      target_id: caseId,
      ip_address: ip,
      user_agent: userAgent,
      payload: { flagged, reason: reason ?? null },
      created_at: now,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* Audit failure must not block response */ });

  return ok({ caseId, flagged, flagReason: flagged ? (reason ?? null) : null }, requestId);
}
