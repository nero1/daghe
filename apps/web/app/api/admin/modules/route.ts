import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"), { requireRole: ["admin"] });
  if (!user) return fail(403, "forbidden", "Admin role required", requestId);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "Supabase not configured", requestId);
  const res = await fetch(`${url}/rest/v1/modules?select=id,display_name,enabled,model_version,version&order=id.asc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return fail(502, "db_error", "Failed to fetch modules", requestId);
  const rows = await res.json();
  return ok(rows, requestId);
}
