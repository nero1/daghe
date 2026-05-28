import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { getUserScope, requireAuthenticatedUser } from "@/lib/server/auth";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);
  if (user.role !== "supervisor" && user.role !== "admin") return fail(403, "ROLE_REQUIRED", "Supervisor or admin role required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Dashboard backend not configured", requestId);

  const scope = user.role === "supervisor" ? await getUserScope(user.id) : null;
  const response = await fetch(`${url}/rest/v1/rpc/get_chw_case_stats`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(scope ? { clinic_id: scope.clinicId, region_id: scope.regionId } : {}),
  });

  if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch CHW stats", requestId, await response.text());

  const rows = await response.json();
  return ok({ rows }, requestId);
}
