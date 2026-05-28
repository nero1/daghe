import type { LocalEncounter } from "@daghe/shared";
import { markEncounterSynced, markEncounterFailed } from "@/lib/encounters";

// Exponential backoff with a 60s cap and ±20% jitter to spread retries across devices.
export function calculateBackoffDelayMs(retryCount: number): number {
  const base = Math.min(60000, 1000 * 2 ** retryCount);
  const jitter = Math.floor(Math.random() * base * 0.2);
  return base + jitter;
}

// Applies server sync outcomes to local IndexedDB encounter metadata.
// `duplicate` is treated as synced because the record already exists upstream.
export async function applyEncounterSyncResults(
  results: { id: string; status: "synced" | "duplicate" | "failed" }[],
  sourceEncounters: LocalEncounter[]
): Promise<void> {
  for (const result of results) {
    if (result.status === "failed") {
      const existing = sourceEncounters.find((e) => e.id === result.id);
      const retryCount = (existing?.retryCount ?? 0) + 1;
      const nextRetryAt = new Date(Date.now() + calculateBackoffDelayMs(retryCount)).toISOString();
      await markEncounterFailed(result.id, retryCount, nextRetryAt);
    } else {
      await markEncounterSynced(result.id);
    }
  }
}
