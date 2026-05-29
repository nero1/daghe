import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

const patchSchema = z.object({ provider: z.enum(["gemini", "openai", "deepseek"]), enabled: z.boolean() });

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"), { requireRole: ["admin"] });
  if (!user) return fail(403, "forbidden", "Admin role required", requestId);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "Supabase not configured", requestId);
  const res = await fetch(`${url}/rest/v1/admin_config?key=in.(gemini_enabled,openai_enabled,deepseek_enabled)&select=key,value`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return fail(502, "db_error", "Failed to fetch config", requestId);
  const rows = (await res.json()) as Array<{ key: string; value: unknown }>;
  const config: Record<string, boolean> = {};
  for (const r of rows) config[r.key] = r.value === true || r.value === "true";
  return ok(config, requestId);
}

export async function PATCH(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"), { requireRole: ["admin"] });
  if (!user) return fail(403, "forbidden", "Admin role required", requestId);
  let body: z.infer<typeof patchSchema>;
  try { body = patchSchema.parse(await request.json()); } catch { return fail(400, "invalid_body", "provider + enabled required", requestId); }
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "Supabase not configured", requestId);
  const res = await fetch(`${url}/rest/v1/admin_config?key=eq.${body.provider}_enabled`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ value: body.enabled, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return fail(502, "db_error", "Failed to update config", requestId);
  return ok({ provider: body.provider, enabled: body.enabled }, requestId);
}
