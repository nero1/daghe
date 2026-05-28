export type LocalCase = {
  id: string;
  localCaseId: string;
  idempotencyKey: string;
  createdAt: string;
  patientAgeRange: string;
  patientSex?: string;
  symptomCluster: string;
  answers: Record<string, boolean>;
  riskLevel: string;
  outcomeKey?: string;
  likelyCondition: string;
  recommendation: string;
  redFlags: string[];
  careAdvice: string;
  referralRequired: boolean;
  decisionTreeVersion: string;
  appVersion: string;
  locationLat?: number;
  locationLng?: number;
  locationAccuracy?: number;
  syncStatus: "unsynced" | "synced" | "failed";
  retryCount?: number;
  nextRetryAt?: string;
};

const DB_NAME = "asibi";
const STORE = "cases";
// Bumped to 5: added locationLat, locationLng, locationAccuracy.
const VERSION = 5;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readCases(): Promise<LocalCase[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as LocalCase[]).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)));
    request.onerror = () => reject(request.error);
  });
}

export async function saveCase(localCase: Omit<LocalCase, "localCaseId" | "idempotencyKey">): Promise<void> {
  const db = await openDb();
  // localCaseId keeps a stable device-side identifier; idempotencyKey prevents duplicate server writes.
  const fullCase: LocalCase = { ...localCase, localCaseId: localCase.id, idempotencyKey: crypto.randomUUID(), retryCount: 0 };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(fullCase);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markCaseStatus(id: string, status: LocalCase["syncStatus"], retryMeta?: { retryCount: number; nextRetryAt: string }): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as LocalCase | undefined;
      if (existing) store.put({ ...existing, syncStatus: status, ...(retryMeta ?? {}) });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
