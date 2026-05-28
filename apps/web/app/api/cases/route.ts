import { z } from "zod";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { requireAuthenticatedUser } from "@/lib/server/auth";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  riskLevel: z.string().optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Cases backend not configured", requestId);

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Invalid query parameters", requestId, parsed.error.flatten());

  const { limit, cursor, dateFrom, dateTo, riskLevel } = parsed.data;

  const endpoint = new URL(`${url}/rest/v1/cases`);
  endpoint.searchParams.set("select", "id,local_case_id,created_at,patient_age_range,patient_sex,risk_level,recommended_action,referral_required,synced_at,symptoms,triage_result");
  endpoint.searchParams.set("order", "created_at.desc");

  // CHWs see only their own cases; supervisors and admins see all via service role.
  if (user.role === "chw") endpoint.searchParams.set("chw_user_id", `eq.${user.id}`);
  if (riskLevel && riskLevel !== "all") endpoint.searchParams.set("risk_level", `eq.${riskLevel}`);
  if (dateFrom) endpoint.searchParams.set("created_at", `gte.${dateFrom}`);
  if (dateTo) endpoint.searchParams.set("created_at", `lte.${dateTo}`);

  // Cursor-based pagination using created_at as the cursor value.
  if (cursor) endpoint.searchParams.set("created_at", `lt.${cursor}`);
  endpoint.searchParams.set("limit", String(limit + 1)); // fetch one extra to detect next page

  const response = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch cases", requestId, await response.text());

  const rows = await response.json();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;

  return ok({ rows: page, nextCursor, hasMore }, requestId);
}
