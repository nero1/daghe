import Dexie, { type Table } from "dexie";
import type { LocalEncounter } from "@daghe/shared";

type DevicePref = { key: string; value: unknown };
type FacilityTokenRecord = { id: string; token: string; expiresAt: string };

class DagheDB extends Dexie {
  encounters!: Table<LocalEncounter>;
  devicePrefs!: Table<DevicePref>;
  facilityToken!: Table<FacilityTokenRecord>;

  constructor() {
    super("daghe");
    this.version(1).stores({
      encounters: "id, syncStatus, moduleId, utcTime, facilityId, isDemoEncounter",
      devicePrefs: "key",
      facilityToken: "id",
    });
  }
}

export const db = new DagheDB();

export async function saveEncounter(enc: Omit<LocalEncounter, "idempotencyKey">): Promise<void> {
  const full: LocalEncounter = { ...enc, idempotencyKey: crypto.randomUUID() };
  await db.encounters.put(full);
}

export async function getUnsyncedEncounters(): Promise<LocalEncounter[]> {
  return db.encounters
    .where("syncStatus")
    .anyOf(["pending", "failed"])
    .filter((e) => !e.isDemoEncounter)
    .toArray();
}

export async function markEncounterSynced(id: string): Promise<void> {
  await db.encounters.update(id, { syncStatus: "synced", retryCount: 0 });
}

export async function markEncounterFailed(
  id: string,
  retryCount: number,
  nextRetryAt: string
): Promise<void> {
  await db.encounters.update(id, { syncStatus: "failed", retryCount, nextRetryAt });
}

export async function getAllEncounters(): Promise<LocalEncounter[]> {
  return db.encounters
    .orderBy("utcTime")
    .reverse()
    .filter((e) => !e.isDemoEncounter)
    .toArray();
}

export async function getDevicePref<T>(key: string): Promise<T | undefined> {
  const row = await db.devicePrefs.get(key);
  return row?.value as T | undefined;
}

export async function setDevicePref<T>(key: string, value: T): Promise<void> {
  await db.devicePrefs.put({ key, value });
}
