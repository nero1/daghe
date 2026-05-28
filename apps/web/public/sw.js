// Service Worker version — bump this string whenever the app shell changes
// so returning users get fresh assets and the update prompt appears.
const VERSION = "asibi-shell-mpd9u9qu";

// App shell: routes and assets that must be available offline.
const SHELL_URLS = ["/", "/app", "/demo", "/triage", "/cases", "/register", "/admin"];

// Cache name used to store the last known triage rules version.
const RULES_VERSION_CACHE = "asibi-rules-version-v1";

// On install: cache all shell URLs.
// Do NOT call skipWaiting here — the update prompt in sw-register.tsx lets the
// user choose when to apply the update so an in-progress triage is never interrupted.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL_URLS))
  );
});

// On activate: delete all caches from older versions, claim clients, and check triage rules version.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION && k !== RULES_VERSION_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() => checkTriageRulesVersion())
  );
});

async function checkTriageRulesVersion() {
  try {
    const response = await fetch("/api/triage/rules", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    const newVersion = body?.data?.version ?? body?.version;
    if (!newVersion) return;

    const versionCache = await caches.open(RULES_VERSION_CACHE);
    const stored = await versionCache.match("triage-rules-version");
    const oldVersion = stored ? await stored.text() : null;

    // Always store the latest version.
    await versionCache.put("triage-rules-version", new Response(String(newVersion)));

    if (oldVersion && oldVersion !== String(newVersion)) {
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.postMessage({ type: "TRIAGE_RULES_UPDATED", version: newVersion });
      });
    }
  } catch {
    // Network unavailable or endpoint doesn't exist — skip silently.
  }
}

// Fetch strategy: cache-first for shell routes, network-first for API calls.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept non-GET requests or cross-origin requests.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // API and auth routes must always go to the network (no stale data for health decisions).
  if (url.pathname.startsWith("/api/")) return;

  // For navigations and shell assets: cache-first, fall back to network.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful same-origin GET responses for future offline use.
        if (response.ok && response.type === "basic") {
          const toCache = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => {
        // Offline and not in cache: return the root shell for navigation requests.
        if (event.request.mode === "navigate") return caches.match("/");
        return new Response("Offline", { status: 503 });
      });
    })
  );
});

// Listen for a message from the client asking to skip waiting (for update prompts).
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
