import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"), { requireRole: ["admin"] });
  if (!user) return fail(403, "forbidden", "Admin role required", requestId);
  let body: z.infer<typeof patchSchema>;
  try { body = patchSchema.parse(await request.json()); } catch { return fail(400, "invalid_body", "enabled (boolean) required", requestId); }
  const { id } = await params;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "Supabase not configured", requestId);
  const res = await fetch(`${url}/rest/v1/modules?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ enabled: body.enabled, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return fail(502, "db_error", "Failed to update module", requestId);
  return ok({ id, enabled: body.enabled }, requestId);
}
