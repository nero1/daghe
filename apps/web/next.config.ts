import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "connect-src 'self' https: https://generativelanguage.googleapis.com https://api.openai.com https://api.deepseek.com",
    ].join("; ")
  }
];

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
  async headers() {
    return [
      // sw.js must never be cached — browser must re-fetch it on every load
      // so it detects new deployments within seconds, not up to 24 hours.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache" }],
      },
      { source: "/:path*", headers: securityHeaders },
    ];
  }
};

export default nextConfig;
