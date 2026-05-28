import { markCaseStatus, type LocalCase } from "@/lib/cases";

// Exponential backoff with a 60s cap and ±20% jitter to spread retries across devices.
export function calculateBackoffDelayMs(retryCount: number): number {
  const base = Math.min(60000, 1000 * 2 ** retryCount);
  const jitter = Math.floor(Math.random() * base * 0.2);
  return base + jitter;
}

/**
 * Applies server sync outcomes to local IndexedDB case metadata.
 * Edge cases:
 * - `duplicate` is treated as synced because the record already exists upstream.
 * - Failed records receive incremented retry counters and scheduled retry timestamps.
 */
export async function applySyncResults(results: { id: string; status: "synced" | "duplicate" | "failed" }[], sourceCases: LocalCase[]) {
  for (const result of results) {
    if (result.status === "failed") {
      const existing = sourceCases.find((c) => c.id === result.id);
      const retryCount = (existing?.retryCount ?? 0) + 1;
      // Schedule the next retry timestamp so background sync waits the required delay.
      const nextRetryAt = new Date(Date.now() + calculateBackoffDelayMs(retryCount)).toISOString();
      await markCaseStatus(result.id, "failed", { retryCount, nextRetryAt });
    } else {
      // Treat duplicate as success because the case already exists upstream.
      await markCaseStatus(result.id, "synced", { retryCount: 0, nextRetryAt: "" });
    }
  }
}
