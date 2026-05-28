import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { getUserScope, requireAuthenticatedUser } from "@/lib/server/auth";

const MAX_EXPORT_ROWS = 5000;

async function writeAuditLog(url: string, key: string, userId: string, role: string, filters: Record<string, string>) {
  await fetch(`${url}/rest/v1/audit_logs`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      actor_user_id: userId,
      actor_role: role,
      action: "dashboard_export_csv",
      payload: filters,
      created_at: new Date().toISOString(),
    }),
  });
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);
  if (user.role !== "supervisor" && user.role !== "admin") return fail(403, "ROLE_REQUIRED", "Supervisor or admin role required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Export backend not configured", requestId);

  const parsedUrl = new URL(request.url);
  const riskLevel = parsedUrl.searchParams.get("riskLevel");
  const dateFrom = parsedUrl.searchParams.get("dateFrom") ?? undefined;
  const dateTo = parsedUrl.searchParams.get("dateTo") ?? undefined;
  const endpoint = new URL(`${url}/rest/v1/cases`);
  endpoint.searchParams.set("select", "id,created_at,risk_level,recommended_action,chw_user_id,clinic_id,region_id");
  endpoint.searchParams.set("order", "created_at.desc");
  if (riskLevel && ["monitor", "treat_local", "refer", "urgent", "emergency"].includes(riskLevel)) endpoint.searchParams.set("risk_level", `eq.${riskLevel}`);
  // BUG-009 fix: append keeps both time bounds.
  if (dateFrom) endpoint.searchParams.append("created_at", `gte.${dateFrom}`);
  if (dateTo) endpoint.searchParams.append("created_at", `lte.${dateTo}`);
  if (user.role === "supervisor") {
    const scope = await getUserScope(user.id);
    // BUG-002 fix: constrain supervisor export to clinic/region scope.
    if (scope.clinicId && scope.regionId) endpoint.searchParams.set("or", `(clinic_id.eq.${scope.clinicId},region_id.eq.${scope.regionId})`);
    else if (scope.clinicId) endpoint.searchParams.set("clinic_id", `eq.${scope.clinicId}`);
    else if (scope.regionId) endpoint.searchParams.set("region_id", `eq.${scope.regionId}`);
  }

  // BUG-010 fix: page through export in chunks with a hard cap to avoid large single-query payloads.
  const PAGE_SIZE = 1000;
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; from < MAX_EXPORT_ROWS; from += PAGE_SIZE) {
    const to = Math.min(MAX_EXPORT_ROWS - 1, from + PAGE_SIZE - 1);
    const response = await fetch(endpoint.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${to}` }
    });
    if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to export cases", requestId, await response.text());
    const chunk = await response.json() as Array<Record<string, unknown>>;
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }

  const header = ["id", "created_at", "risk_level", "recommended_action", "chw_user_id"];
  const csvRows = [header.join(","), ...rows.map((r) => header.map((h) => JSON.stringify(r[h] ?? "")).join(","))];

  writeAuditLog(url, key, user.id, user.role, { riskLevel: riskLevel ?? "all", dateFrom: dateFrom ?? "", dateTo: dateTo ?? "", rowCap: String(MAX_EXPORT_ROWS), pageSize: "1000" }).catch(() => {});

  return ok({ filename: `asibi-cases-${new Date().toISOString().slice(0, 10)}.csv`, csv: csvRows.join("\n"), truncated: rows.length >= MAX_EXPORT_ROWS }, requestId);
}
