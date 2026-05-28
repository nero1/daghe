"use client";


import { useEffect } from "react";
import { readCases } from "@/lib/cases";
import { ensureCsrfToken } from "@/lib/csrf";

const LOCK_KEY = "asibi_sync_lock";
const BATCH_SIZE = 50;

function acquireLock(): boolean {
  const now = Date.now();
  const current = Number(localStorage.getItem(LOCK_KEY) ?? 0);
  // Prevent two tabs from syncing simultaneously for ~25 seconds.
  if (current && now - current < 25000) return false;
  localStorage.setItem(LOCK_KEY, String(now));
  return true;
}

function releaseLock() {
  localStorage.removeItem(LOCK_KEY);
}

export default function SyncAgent() {
  useEffect(() => {
    const run = async () => {
      if (!navigator.onLine || !acquireLock()) return;
      try {
        const cases = await readCases();
        const due = cases.filter((c) => c.syncStatus !== "synced" && (!c.nextRetryAt || new Date(c.nextRetryAt).getTime() <= Date.now()));
        if (!due.length) return;
        // Batch to avoid a single oversized request when many cases are queued.
        for (let i = 0; i < due.length; i += BATCH_SIZE) {
          const batch = due.slice(i, i + BATCH_SIZE);
          // BUG-004 fix: include CSRF token for background sync endpoint protection.
          const csrf = await ensureCsrfToken();
          let response = await fetch("/api/cases/sync", {
            method: "POST",
            headers: { "content-type": "application/json", "x-csrf-token": csrf },
            credentials: "include",
            body: JSON.stringify({ cases: batch })
          });
          if (response.status === 401) {
            const refresh = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", headers: { "x-csrf-token": csrf } });
            if (refresh.ok) {
              response = await fetch("/api/cases/sync", {
                method: "POST",
                headers: { "content-type": "application/json", "x-csrf-token": csrf },
                credentials: "include",
                body: JSON.stringify({ cases: batch })
              });
            }
          }
        }
      } finally {
        releaseLock();
      }
    };

    run();
    const id = setInterval(run, 30000);
    // Jitter on reconnect spreads burst sync traffic when many devices come back online together.
    const onOnline = () => setTimeout(run, Math.floor(Math.random() * 10000));
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}

