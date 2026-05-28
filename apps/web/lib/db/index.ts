// Thin typed adapter over Supabase REST — swap the implementation here to change DB without touching routes

type SupabaseConfig = { url: string; key: string };

function getConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

type QueryOptions = {
  select?: string;
  filters?: Record<string, string>;
  order?: string;
  limit?: number;
  offset?: number;
};

export async function dbSelect<T>(table: string, opts: QueryOptions = {}): Promise<T[] | null> {
  const cfg = getConfig();
  if (!cfg) return null;
  const endpoint = new URL(`${cfg.url}/rest/v1/${table}`);
  if (opts.select) endpoint.searchParams.set("select", opts.select);
  if (opts.order) endpoint.searchParams.set("order", opts.order);
  if (opts.limit) endpoint.searchParams.set("limit", String(opts.limit));
  if (opts.offset) endpoint.searchParams.set("offset", String(opts.offset));
  for (const [k, v] of Object.entries(opts.filters ?? {})) {
    endpoint.searchParams.set(k, v);
  }
  try {
    const res = await fetch(endpoint.toString(), {
      headers: headers(cfg.key),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

export async function dbInsert<T>(table: string, data: Record<string, unknown>, prefer = "return=representation"): Promise<T[] | null> {
  const cfg = getConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers(cfg.key), Prefer: prefer },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    if (prefer.includes("return=minimal")) return [] as T[];
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

export async function dbUpsert<T>(table: string, data: Record<string, unknown>, prefer = "resolution=merge-duplicates,return=representation"): Promise<T[] | null> {
  const cfg = getConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers(cfg.key), Prefer: prefer },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    if (prefer.includes("return=minimal")) return [] as T[];
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

export async function dbUpdate(table: string, filters: Record<string, string>, data: Record<string, unknown>): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg) return false;
  const endpoint = new URL(`${cfg.url}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(filters)) endpoint.searchParams.set(k, v);
  try {
    const res = await fetch(endpoint.toString(), {
      method: "PATCH",
      headers: { ...headers(cfg.key), Prefer: "return=minimal" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function dbDelete(table: string, filters: Record<string, string>): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg) return false;
  const endpoint = new URL(`${cfg.url}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(filters)) endpoint.searchParams.set(k, v);
  try {
    const res = await fetch(endpoint.toString(), {
      method: "DELETE",
      headers: { ...headers(cfg.key), Prefer: "return=minimal" },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
