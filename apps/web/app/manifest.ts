import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Asibi",
    short_name: "Asibi",
    description: "Offline CHW climate triage",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#0ea5e9",
    icons: [
      { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ]
  };
}

