import { z } from "zod";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { getUserScope, requireAuthenticatedUser } from "@/lib/server/auth";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().refine((v) => [10, 20, 50, 100].includes(v), "Invalid limit").default(20),
  riskLevel: z.enum(["all", "monitor", "treat_local", "refer", "urgent", "emergency"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  illnessType: z.string().optional(),
  chwUserId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  clinicId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);
  if (user.role !== "supervisor" && user.role !== "admin") return fail(403, "ROLE_REQUIRED", "Supervisor or admin role required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Dashboard backend not configured", requestId);

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Invalid query parameters", requestId, parsed.error.flatten());

  const { page, limit, riskLevel, dateFrom, dateTo, illnessType, chwUserId, regionId, clinicId } = parsed.data;
  const scope = user.role === "supervisor" ? await getUserScope(user.id) : null;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const endpoint = new URL(`${url}/rest/v1/cases`);
  endpoint.searchParams.set("select", "id,created_at,risk_level,recommended_action,triage_result,chw_user_id,patient_age_range,referral_required,clinic_id,region_id");
  endpoint.searchParams.set("order", "created_at.desc");

  if (riskLevel && riskLevel !== "all") endpoint.searchParams.set("risk_level", `eq.${riskLevel}`);
  // BUG-009 fix: use append so both range clauses are preserved.
  if (dateFrom) endpoint.searchParams.append("created_at", `gte.${dateFrom}`);
  if (dateTo) endpoint.searchParams.append("created_at", `lte.${dateTo}`);
  // Filter by symptom cluster stored in the symptoms JSONB column.
  if (illnessType) endpoint.searchParams.set("symptoms->>cluster", `eq.${illnessType}`);
  if (chwUserId) endpoint.searchParams.set("chw_user_id", `eq.${chwUserId}`);
  const appliedRegion = user.role === "supervisor" ? scope?.regionId ?? null : (regionId ?? null);
  const appliedClinic = user.role === "supervisor" ? scope?.clinicId ?? null : (clinicId ?? null);
  // BUG-002 fix: supervisors are constrained to clinic/region scope from users table.
  if (appliedRegion && appliedClinic) endpoint.searchParams.set("or", `(clinic_id.eq.${appliedClinic},region_id.eq.${appliedRegion})`);
  else if (appliedRegion) endpoint.searchParams.set("region_id", `eq.${appliedRegion}`);
  else if (appliedClinic) endpoint.searchParams.set("clinic_id", `eq.${appliedClinic}`);

  const response = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: `${from}-${to}` }
  });
  if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch cases", requestId, await response.text());

  const rows = await response.json();
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? rows.length);

  return ok({ page, limit, total, rows }, requestId);
}
