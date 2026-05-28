import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:;"
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

