import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { encryptKey, maskKey } from "@/lib/server/byok";

const postSchema = z.object({
  provider: z.enum(["gemini", "openai", "deepseek"]),
  apiKey: z.string().min(10).max(256),
});

const deleteSchema = z.object({
  provider: z.enum(["gemini", "openai", "deepseek"]),
});

type KeyRow = {
  provider: string;
  encrypted_key_ciphertext: string;
  updated_at: string;
};

async function upsertKey(userId: string, provider: string, encrypted: { iv: string; ciphertext: string; tag: string }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");

  const res = await fetch(`${url}/rest/v1/user_api_keys`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      provider,
      encrypted_key_iv: encrypted.iv,
      encrypted_key_ciphertext: encrypted.ciphertext,
      encrypted_key_tag: encrypted.tag,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`Supabase upsert failed: ${res.status}`);
}

async function deleteKey(userId: string, provider: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");

  const endpoint = new URL(`${url}/rest/v1/user_api_keys`);
  endpoint.searchParams.set("user_id", `eq.${userId}`);
  endpoint.searchParams.set("provider", `eq.${provider}`);

  const res = await fetch(endpoint.toString(), {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`Supabase delete failed: ${res.status}`);
}

async function listKeys(userId: string): Promise<Array<{ provider: string; maskedKey: string; updatedAt: string }>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const endpoint = new URL(`${url}/rest/v1/user_api_keys`);
  endpoint.searchParams.set("select", "provider,encrypted_key_ciphertext,updated_at");
  endpoint.searchParams.set("user_id", `eq.${userId}`);

  const res = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return [];
  const rows = (await res.json()) as KeyRow[];
  // Return masked preview — never the decrypted plaintext
  return rows.map(r => ({
    provider: r.provider,
    maskedKey: maskKey(r.encrypted_key_ciphertext.slice(0, 20)),
    updatedAt: r.updated_at,
  }));
}

// POST /api/keys — store an encrypted BYOK key (supervisor+ only)
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["supervisor", "admin"],
  });
  if (!user) return fail(401, "unauthorized", "Supervisor or admin role required", requestId);

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return fail(400, "invalid_body", "Request body validation failed", requestId);
  }

  try {
    const encrypted = encryptKey(body.apiKey);
    await upsertKey(user.id, body.provider, encrypted);
    return ok({ provider: body.provider, maskedKey: maskKey(body.apiKey) }, requestId);
  } catch {
    return fail(500, "store_failed", "Failed to store key", requestId);
  }
}

// GET /api/keys — list masked keys for the current user (supervisor+ only)
export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["supervisor", "admin"],
  });
  if (!user) return fail(401, "unauthorized", "Supervisor or admin role required", requestId);

  try {
    const keys = await listKeys(user.id);
    return ok({ keys }, requestId);
  } catch {
    return fail(500, "fetch_failed", "Failed to fetch keys", requestId);
  }
}

// DELETE /api/keys — remove a BYOK key (supervisor+ only)
export async function DELETE(request: NextRequest) {
  const requestId = requestIdFrom(request);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["supervisor", "admin"],
  });
  if (!user) return fail(401, "unauthorized", "Supervisor or admin role required", requestId);

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return fail(400, "invalid_body", "Request body validation failed", requestId);
  }

  try {
    await deleteKey(user.id, body.provider);
    return ok({ deleted: true, provider: body.provider }, requestId);
  } catch {
    return fail(500, "delete_failed", "Failed to delete key", requestId);
  }
}
