"use client";

import { useEffect, useState } from "react";

type ModelLoadState = "idle" | "downloading" | "done" | "error";

// Background TFLite model download with progress indicator.
// Models are stored in the "daghe-models-v1" Cache API cache.
// This component is rendered once in the layout after the user is authenticated.
export function ModelLoader() {
  const [state, setState] = useState<ModelLoadState>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) return;

    void downloadModelsIfNeeded();
  }, []);

  async function downloadModelsIfNeeded() {
    const MODEL_CACHE = "daghe-models-v1";
    const MODELS = [
      "/models/efficientdet-lite3-cervical-v1.2.tflite",
      "/models/mobilenetv2-cervical-via-v1.2.tflite",
    ];

    try {
      const cache = await caches.open(MODEL_CACHE);
      const cached = await Promise.all(MODELS.map(m => cache.match(m)));
      const missing = MODELS.filter((_, i) => !cached[i]);
      if (missing.length === 0) {
        setState("done");
        return;
      }

      setState("downloading");
      let completed = 0;

      for (const modelUrl of missing) {
        const res = await fetch(modelUrl);
        if (!res.ok) {
          setState("error");
          return;
        }
        await cache.put(modelUrl, res.clone());
        completed += 1;
        setProgress(Math.round((completed / missing.length) * 100));
      }

      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "idle" || state === "done") return null;

  if (state === "error") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          color: "#92400e",
          zIndex: 9000,
        }}
      >
        AI model download failed. On-device analysis unavailable.
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        background: "#eff6ff",
        border: "1px solid #3b82f6",
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        color: "#1e40af",
        zIndex: 9000,
      }}
    >
      Downloading AI model… {progress}%
    </div>
  );
}
