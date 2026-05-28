"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  const [rulesVersion, setRulesVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      const checkWaiting = (r: ServiceWorkerRegistration) => {
        if (r.waiting) {
          setNewWorker(r.waiting);
          setUpdateReady(true);
        }
      };

      checkWaiting(reg);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setNewWorker(installing);
            setUpdateReady(true);
          }
        });
      });

      // Poll for updates every 8 hours — the browser already checks on every
      // navigation, so this only matters for tabs left open with zero interaction.
      const interval = setInterval(() => reg.update(), 8 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }).catch(() => {
      // App works without SW — offline features just won't be available.
    });

    // Reload at the precise moment the new SW takes control, not just when we
    // send skipWaiting (which can be slightly earlier).
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "TRIAGE_RULES_UPDATED") {
        setRulesVersion(String(event.data.version));
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  function applyUpdate() {
    if (!newWorker) return;
    // Reload is handled by the controllerchange listener above.
    newWorker.postMessage("skipWaiting");
  }

  return (
    <>
      {updateReady && (
        <div style={{
          position: "fixed", bottom: rulesVersion ? "4.5rem" : 0, left: 0, right: 0,
          background: "#0ea5e9", color: "white",
          padding: "1rem", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "1rem", zIndex: 9999,
        }}>
          <span>A new version of Asibi is available.</span>
          <button onClick={applyUpdate} style={{ background: "white", color: "#0ea5e9", fontWeight: 700 }}>
            Update now
          </button>
        </div>
      )}
      {rulesVersion && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#1565c0", color: "white",
          padding: "1rem", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "1rem", zIndex: 9998,
        }}>
          <span style={{ fontSize: "0.9rem" }}>
            Triage rules updated to version {rulesVersion}. Reload to apply the latest clinical guidelines.
          </span>
          <button onClick={() => window.location.reload()} style={{ background: "white", color: "#1565c0", fontWeight: 700, whiteSpace: "nowrap" }}>
            Reload Now
          </button>
        </div>
      )}
    </>
  );
}
